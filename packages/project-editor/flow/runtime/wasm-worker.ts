require("project-editor/flow/runtime/flow_runtime.js");

import type {
    RendererToWorkerMessage,
    WorkerToRenderMessage,
    IPropertyValue,
    ObjectGlobalVariableValues
} from "project-editor/flow/runtime/wasm-worker-interfaces";
import { init as initExecuteFunctions } from "project-editor/flow/runtime/wasm-execute-functions-init";
import { actionConmponentExecuteFunctions } from "project-editor/flow/runtime/wasm-execute-functions";
import {
    createWasmArrayValue,
    getValue,
    getArrayValue,
    createJsArrayValue
} from "project-editor/flow/runtime/wasm-value";
import type { IDashboardComponentContext, ValueType } from "eez-studio-types";

function startToDebuggerMessage() {}

function writeDebuggerBuffer(arr: any) {
    const data: WorkerToRenderMessage = {
        messageToDebugger: new Uint8Array(arr)
    };

    postMessage(data);
}

function finishToDebuggerMessage() {}

function executeScpi(instrumentPtr: number, arr: any, isQuery: number) {
    const result = getArrayValue(instrumentPtr, ["object:Instrument"]);
    if (!result) {
        WasmFlowRuntime._onScpiResult(
            WasmFlowRuntime.allocateUTF8("Invalid instrument"),
            0,
            0
        );
        return;
    }

    const instrument = result.value as any as {
        id: string;
    };

    const data: WorkerToRenderMessage = {
        scpiCommand: {
            instrumentId: instrument.id,
            command: new Uint8Array(arr),
            isQuery: isQuery ? true : false
        }
    };

    postMessage(data);
}

export class DashboardComponentContext implements IDashboardComponentContext {
    context: number = 0;

    getFlowIndex(): number {
        return WasmFlowRuntime._DashboardContext_getFlowIndex(this.context);
    }

    getComponentIndex(): number {
        return WasmFlowRuntime._DashboardContext_getComponentIndex(
            this.context
        );
    }

    startAsyncExecution() {
        const dashboardComponentContext = new DashboardComponentContext();

        dashboardComponentContext.context =
            WasmFlowRuntime._DashboardContext_startAsyncExecution(this.context);

        return dashboardComponentContext;
    }

    endAsyncExecution() {
        WasmFlowRuntime._DashboardContext_endAsyncExecution(this.context);
    }

    evalProperty<T>(propertyIndex: number, expectedTypes?: ValueType[]) {
        const valuePtr = WasmFlowRuntime._DashboardContext_evalProperty(
            this.context,
            propertyIndex
        );

        if (!valuePtr) {
            return undefined;
        }

        const result = getValue(valuePtr);

        WasmFlowRuntime._valueFree(valuePtr);

        if (expectedTypes && expectedTypes.indexOf(result.valueType) == -1) {
            return undefined;
        }

        return result.value as any as T;
    }

    getStringParam(offset: number) {
        const ptr = WasmFlowRuntime._DashboardContext_getStringParam(
            this.context,
            offset
        );
        return WasmFlowRuntime.AsciiToString(ptr);
    }

    getExpressionListParam(offset: number) {
        const ptr = WasmFlowRuntime._DashboardContext_getExpressionListParam(
            this.context,
            offset
        );

        const values: any[] = [];

        if (ptr) {
            const count = WasmFlowRuntime.HEAPU32[(ptr >> 2) + 0];
            for (let i = 0; i < count; i++) {
                let offset = ptr + 8 + 16 * i;
                values.push(getValue(offset).value);
            }

            WasmFlowRuntime._DashboardContext_freeExpressionListParam(
                this.context,
                ptr
            );
        }

        return values;
    }

    propagateValue(outputName: string, value: any) {
        const flowIndex = this.getFlowIndex();
        const flow = WasmFlowRuntime.assetsMap.flows[flowIndex];
        const componentIndex = this.getComponentIndex();
        const component = flow.components[componentIndex];
        const outputIndex = component.outputs.findIndex(
            output => output.outputName == outputName
        );
        if (outputIndex == -1) {
            this.throwError(`Output "${outputName}" not found`);
        }

        if (typeof value == "number") {
            if (Number.isInteger(value)) {
                WasmFlowRuntime._DashboardContext_propagateIntValue(
                    this.context,
                    outputIndex,
                    value
                );
            } else {
                WasmFlowRuntime._DashboardContext_propagateDoubleValue(
                    this.context,
                    outputIndex,
                    value
                );
            }
        } else if (typeof value == "boolean") {
            WasmFlowRuntime._DashboardContext_propagateBooleanValue(
                this.context,
                outputIndex,
                value
            );
        } else if (typeof value == "string") {
            const valuePtr = WasmFlowRuntime.allocateUTF8(value);
            WasmFlowRuntime._DashboardContext_propagateStringValue(
                this.context,
                outputIndex,
                valuePtr
            );
            WasmFlowRuntime._free(valuePtr);
        } else if (value === undefined) {
            WasmFlowRuntime._DashboardContext_propagateUndefinedValue(
                this.context,
                outputIndex
            );
        } else if (value === null) {
            WasmFlowRuntime._DashboardContext_propagateNullValue(
                this.context,
                outputIndex
            );
        } else {
            const flowIndex = this.getFlowIndex();
            const flow = WasmFlowRuntime.assetsMap.flows[flowIndex];

            const componentIndex = this.getComponentIndex();
            const component = flow.components[componentIndex];

            const output = component.outputs[outputIndex];

            const valueTypeIndex = output.valueTypeIndex;
            if (valueTypeIndex == -1) {
                this.throwError("Invalid value");
            } else {
                const arrayValue = createJsArrayValue(
                    valueTypeIndex,
                    value,
                    WasmFlowRuntime.assetsMap,
                    undefined
                );

                if (arrayValue) {
                    const valuePtr = createWasmArrayValue(arrayValue);
                    WasmFlowRuntime._DashboardContext_propagateValue(
                        this.context,
                        outputIndex,
                        valuePtr
                    );
                    WasmFlowRuntime._valueFree(valuePtr);
                } else {
                    this.throwError("Invalid value");
                }
            }
        }
    }

    propagateValueThroughSeqout(): void {
        WasmFlowRuntime._DashboardContext_propagateValueThroughSeqout(
            this.context
        );
    }

    executeCallAction(flowIndex: number) {
        WasmFlowRuntime._DashboardContext_executeCallAction(
            this.context,
            flowIndex
        );
    }

    throwError(errorMessage: string) {
        const errorMessagePtr = WasmFlowRuntime.allocateUTF8(errorMessage);
        WasmFlowRuntime._DashboardContext_throwError(
            this.context,
            errorMessagePtr
        );
        WasmFlowRuntime._free(errorMessagePtr);
    }
}
const dashboardComponentContext = new DashboardComponentContext();

function executeDashboardComponent(componentType: number, context: number) {
    dashboardComponentContext.context = context;

    const componentName =
        WasmFlowRuntime.assetsMap.dashboardComponentTypeToNameMap[
            componentType
        ];

    const executeFunction = actionConmponentExecuteFunctions[componentName];
    if (executeFunction) {
        executeFunction(dashboardComponentContext);
    } else {
        dashboardComponentContext.throwError(
            `Unknown component ${componentName}`
        );
    }
}

(global as any).startToDebuggerMessage = startToDebuggerMessage;
(global as any).writeDebuggerBuffer = writeDebuggerBuffer;
(global as any).finishToDebuggerMessage = finishToDebuggerMessage;
(global as any).executeDashboardComponent = executeDashboardComponent;
(global as any).executeScpi = executeScpi;

function initObjectGlobalVariableValues(
    objectGlobalVariableValues: ObjectGlobalVariableValues
) {
    for (let i = 0; i < objectGlobalVariableValues.length; i++) {
        const objectGlobalVariableValue = objectGlobalVariableValues[i];
        const valuePtr = createWasmArrayValue(
            objectGlobalVariableValue.arrayValue
        );
        WasmFlowRuntime._setGlobalVariable(
            objectGlobalVariableValue.globalVariableIndex,
            valuePtr
        );
        WasmFlowRuntime._valueFree(valuePtr);
    }
}

function updateObjectGlobalVariableValues(
    objectGlobalVariableValues: ObjectGlobalVariableValues
) {
    for (let i = 0; i < objectGlobalVariableValues.length; i++) {
        const objectGlobalVariableValue = objectGlobalVariableValues[i];
        const valuePtr = createWasmArrayValue(
            objectGlobalVariableValue.arrayValue
        );
        WasmFlowRuntime._updateGlobalVariable(
            objectGlobalVariableValue.globalVariableIndex,
            valuePtr
        );
        WasmFlowRuntime._valueFree(valuePtr);
    }
}

onmessage = async function (e: { data: RendererToWorkerMessage }) {
    if (e.data.scpiResult) {
        let errorMessagePtr = 0;
        if (e.data.scpiResult.errorMessage) {
            errorMessagePtr = WasmFlowRuntime.allocateUTF8(
                e.data.scpiResult.errorMessage
            );
        }

        let resultPtr = 0;
        let resultLen = 0;
        if (e.data.scpiResult.result) {
            const resultArr = new Uint8Array(e.data.scpiResult.result);
            resultPtr = WasmFlowRuntime._malloc(resultArr.length + 1);
            WasmFlowRuntime.HEAPU8.set(resultArr, resultPtr);
            WasmFlowRuntime.HEAPU8[resultPtr + resultArr.length] = 0;
            resultLen = resultArr.length;
        }

        WasmFlowRuntime._onScpiResult(errorMessagePtr, resultPtr, resultLen);

        WasmFlowRuntime._mainLoop();

        return;
    }

    if (e.data.messageFromDebugger) {
        const messageFromDebugger = new Uint8Array(e.data.messageFromDebugger);
        var ptr = WasmFlowRuntime._malloc(messageFromDebugger.length);
        WasmFlowRuntime.HEAPU8.set(messageFromDebugger, ptr);

        WasmFlowRuntime._onMessageFromDebugger(ptr, messageFromDebugger.length);

        WasmFlowRuntime._free(ptr);

        WasmFlowRuntime._mainLoop();

        return;
    }

    if (e.data.executeWidgetAction) {
        const { flowStateIndex, componentIndex, outputIndex, arrayValue } =
            e.data.executeWidgetAction;

        const valuePtr = createWasmArrayValue(arrayValue);

        WasmFlowRuntime._propagateValue(
            flowStateIndex,
            componentIndex,
            outputIndex,
            valuePtr
        );

        WasmFlowRuntime._valueFree(valuePtr);

        return;
    }

    if (e.data.init) {
        console.log(e.data.init);

        await initExecuteFunctions(e.data.init.nodeModuleFolders);

        WasmFlowRuntime.assetsMap = e.data.init.assetsMap;

        //
        const assets = e.data.init.assetsData;
        var ptr = WasmFlowRuntime._malloc(assets.length);
        WasmFlowRuntime.HEAPU8.set(assets, ptr);

        WasmFlowRuntime._init(ptr, assets.length);

        WasmFlowRuntime._free(ptr);

        initObjectGlobalVariableValues(e.data.init.objectGlobalVariableValues);

        WasmFlowRuntime._startFlow();
    }

    if (e.data.wheel) {
        if (e.data.wheel.deltaY != 0 || e.data.wheel.clicked != 0) {
            WasmFlowRuntime._onMouseWheelEvent(
                e.data.wheel.deltaY,
                e.data.wheel.clicked
            );
        }
    }

    if (e.data.pointerEvents) {
        for (let i = 0; i < e.data.pointerEvents.length; i++) {
            const pointerEvent = e.data.pointerEvents[i];
            WasmFlowRuntime._onPointerEvent(
                pointerEvent.x,
                pointerEvent.y,
                pointerEvent.pressed
            );
        }
    }

    if (e.data.updateObjectGlobalVariableValues) {
        updateObjectGlobalVariableValues(
            e.data.updateObjectGlobalVariableValues
        );
    }

    WasmFlowRuntime._mainLoop();

    let propertyValues: IPropertyValue[] | undefined;
    if (e.data.evalProperties) {
        propertyValues = e.data.evalProperties.map(evalProperty => {
            const {
                flowStateIndex,
                componentIndex,
                propertyIndex,
                propertyValueIndex,
                indexes
            } = evalProperty;

            let iteratorsPtr = 0;
            if (indexes) {
                const MAX_ITERATORS = 4;

                const arr = new Uint32Array(MAX_ITERATORS);
                for (let i = 0; i < MAX_ITERATORS; i++) {
                    arr[i] = indexes.length < MAX_ITERATORS ? indexes[i] : 0;
                }
                iteratorsPtr = WasmFlowRuntime._malloc(MAX_ITERATORS * 4);
                WasmFlowRuntime.HEAP32.set(arr, iteratorsPtr >> 2);
            }

            const valuePtr = WasmFlowRuntime._evalProperty(
                flowStateIndex,
                componentIndex,
                propertyIndex,
                iteratorsPtr
            );

            if (iteratorsPtr) {
                WasmFlowRuntime._free(iteratorsPtr);
            }

            if (!valuePtr) {
                return {
                    propertyValueIndex,
                    valueWithType: {
                        valueType: "undefined",
                        value: undefined
                    }
                };
            }

            const valueWithType = getValue(valuePtr);

            WasmFlowRuntime._valueFree(valuePtr);

            return {
                propertyValueIndex,
                valueWithType
            };
        });
    }

    const WIDTH = 480;
    const HEIGHT = 272;

    const data: WorkerToRenderMessage = {
        propertyValues
    };

    var buf_addr = WasmFlowRuntime._getSyncedBuffer();
    if (buf_addr != 0) {
        data.screen = new Uint8ClampedArray(
            WasmFlowRuntime.HEAPU8.subarray(
                buf_addr,
                buf_addr + WIDTH * HEIGHT * 4
            )
        );
    }

    postMessage(data);
};