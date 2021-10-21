import React from "react";
import { observable, action, runInAction, reaction } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { _find, _range } from "eez-studio-shared/algorithm";

import {
    registerClass,
    PropertyType,
    makeDerivedClassInfo,
    PropertyInfo,
    specificGroup,
    IEezObject,
    EezObject,
    ClassInfo,
    getParent,
    MessageType
} from "project-editor/core/object";
import {
    getChildOfObject,
    getDocumentStore,
    Message,
    propertyNotSetMessage,
    Section
} from "project-editor/core/store";

import type {
    IFlowContext,
    IResizeHandler
} from "project-editor/flow/flow-interfaces";

import { guid } from "eez-studio-shared/guid";

import {
    ActionComponent,
    AutoSize,
    Component,
    ComponentInput,
    ComponentOutput,
    componentOutputUnique,
    CustomInput,
    makeAssignableExpressionProperty,
    makeExpressionProperty,
    outputIsOptionalIfAtLeastOneOutputExists
} from "project-editor/flow/component";

import { FlowState } from "project-editor/flow/runtime";
import { findAction } from "project-editor/features/action/action";
import { getFlow, getProject } from "project-editor/project/project";
import { onSelectItem } from "project-editor/components/SelectItem";
import { findPage } from "project-editor/features/page/page";
import { Assets, DataBuffer } from "project-editor/features/page/build/assets";
import {
    buildAssignableExpression,
    buildExpression,
    checkExpression,
    evalConstantExpression,
    evalExpression
} from "project-editor/flow/expression/expression";
import { calcComponentGeometry } from "project-editor/flow/editor/render";
import { ValueType } from "project-editor/features/variable/value-type";
import { ProjectEditor } from "project-editor/project-editor-interface";

const NOT_NAMED_LABEL = "<not named>";

export const LeftArrow = () => (
    <div style={{ marginTop: -2, padding: "0 8px" }}>
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <line x1="5" y1="12" x2="9" y2="16"></line>
            <line x1="5" y1="12" x2="9" y2="8"></line>
        </svg>
    </div>
);

export const RightArrow = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <line x1="15" y1="16" x2="19" y2="12"></line>
        <line x1="15" y1="8" x2="19" y2="12"></line>
    </svg>
);

////////////////////////////////////////////////////////////////////////////////

export class StartActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1001,

        icon: (
            <svg viewBox="0 0 10.699999809265137 12">
                <path d="M.5 12c-.3 0-.5-.2-.5-.5V.5C0 .2.2 0 .5 0s.5.2.5.5v11c0 .3-.2.5-.5.5zm10.2-6L4 2v8l6.7-4z" />
            </svg>
        ),
        componentHeaderColor: "#74c8ce"
    });

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: false
            }
        ];
    }
}

registerClass("StartActionComponent", StartActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class EndActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1002,

        icon: (
            <svg viewBox="0 0 10.699999809265137 12">
                <path d="M6.7 6L0 2v8l6.7-4zm3.5 6c-.3 0-.5-.2-.5-.5V.5c0-.3.2-.5.5-.5s.5.2.5.5v11c0 .3-.3.5-.5.5z" />
            </svg>
        ),
        componentHeaderColor: "#74c8ce"
    });

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            }
        ];
    }

    async execute(flowState: FlowState) {
        if (flowState.parentFlowState && flowState.component) {
            flowState.parentFlowState.runtime.propagateValue(
                flowState.parentFlowState,
                flowState.component,
                "@seqout",
                null
            );
        }
        flowState.numActiveComponents--;
        return undefined;
    }
}

registerClass("EndActionComponent", EndActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class InputActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1003,

        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            }
        ],
        label: (component: InputActionComponent) => {
            if (!component.name) {
                return NOT_NAMED_LABEL;
            }
            return component.name;
        },
        icon: (
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M7 4v16l13 -8z"></path>
            </svg>
        ),
        componentHeaderColor: "#abc2a6"
    });

    @observable name: string;

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: false
            }
        ];
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        const flow = getFlow(this);
        dataBuffer.writeUint8(flow.inputComponents.indexOf(this));
    }
}

registerClass("InputActionComponent", InputActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class OutputActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1004,

        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            }
        ],
        label: (component: OutputActionComponent) => {
            if (!component.name) {
                return NOT_NAMED_LABEL;
            }
            return component.name;
        },
        icon: (
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <rect x="5" y="5" width="14" height="14" rx="2"></rect>
            </svg>
        ),
        componentHeaderColor: "#abc2a6"
    });

    @observable name: string;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            }
        ];
    }

    async execute(flowState: FlowState) {
        const componentState = flowState.getComponentState(this);
        const value = componentState.getInputValue("@seqin");
        if (
            value &&
            flowState.parentFlowState &&
            flowState.component &&
            this.name
        ) {
            flowState.parentFlowState.runtime.propagateValue(
                flowState.parentFlowState,
                flowState.component,
                this.wireID,
                value,
                this.name
            );
        }
        return undefined;
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        const flow = getFlow(this);
        dataBuffer.writeUint8(flow.outputComponents.indexOf(this));
    }
}

registerClass("OutputActionComponent", OutputActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class EvalExprActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1006,
        label: () => "Eval Expression",
        componentPaletteLabel: "Eval expr.",
        properties: [
            makeExpressionProperty(
                {
                    name: "expression",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "any"
            )
        ],
        icon: (
            <svg viewBox="0 0 1664 1792">
                <path d="M384 1536q0-53-37.5-90.5T256 1408t-90.5 37.5T128 1536t37.5 90.5T256 1664t90.5-37.5T384 1536zm384 0q0-53-37.5-90.5T640 1408t-90.5 37.5T512 1536t37.5 90.5T640 1664t90.5-37.5T768 1536zm-384-384q0-53-37.5-90.5T256 1024t-90.5 37.5T128 1152t37.5 90.5T256 1280t90.5-37.5T384 1152zm768 384q0-53-37.5-90.5T1024 1408t-90.5 37.5T896 1536t37.5 90.5 90.5 37.5 90.5-37.5 37.5-90.5zm-384-384q0-53-37.5-90.5T640 1024t-90.5 37.5T512 1152t37.5 90.5T640 1280t90.5-37.5T768 1152zM384 768q0-53-37.5-90.5T256 640t-90.5 37.5T128 768t37.5 90.5T256 896t90.5-37.5T384 768zm768 384q0-53-37.5-90.5T1024 1024t-90.5 37.5T896 1152t37.5 90.5 90.5 37.5 90.5-37.5 37.5-90.5zM768 768q0-53-37.5-90.5T640 640t-90.5 37.5T512 768t37.5 90.5T640 896t90.5-37.5T768 768zm768 768v-384q0-52-38-90t-90-38-90 38-38 90v384q0 52 38 90t90 38 90-38 38-90zm-384-768q0-53-37.5-90.5T1024 640t-90.5 37.5T896 768t37.5 90.5T1024 896t90.5-37.5T1152 768zm384-320V192q0-26-19-45t-45-19H192q-26 0-45 19t-19 45v256q0 26 19 45t45 19h1280q26 0 45-19t19-45zm0 320q0-53-37.5-90.5T1408 640t-90.5 37.5T1280 768t37.5 90.5T1408 896t90.5-37.5T1536 768zm128-640v1536q0 52-38 90t-90 38H128q-52 0-90-38t-38-90V128q0-52 38-90t90-38h1408q52 0 90 38t38 90z" />
            </svg>
        ),
        componentHeaderColor: "#A6BBCF"
    });

    @observable expression: string;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            }
        ];
    }

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null",
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            {
                name: "result",
                type: "any",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>{this.expression}</pre>
            </div>
        );
    }

    async execute(flowState: FlowState) {
        const value = evalExpression(flowState, this, this.expression);
        flowState.runtime.propagateValue(flowState, this, "result", value);
        return undefined;
    }
}

registerClass("EvalExprActionComponent", EvalExprActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class EvalJSExprActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        label: () => "Eval JS expression",
        componentPaletteLabel: "Eval JS expr.",
        componentPaletteGroupName: "Dashboard Specific",
        properties: [
            {
                name: "expression",
                type: PropertyType.MultilineText,
                propertyGridGroup: specificGroup,
                monospaceFont: true
            }
        ],
        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            const inputs = EvalJSExprActionComponent.parse(jsObject.expression);
            for (const inputName of inputs) {
                if (
                    !jsObject.customInputs.find(
                        (input: CustomInput) => input.name == inputName
                    )
                ) {
                    jsObject.customInputs.push({
                        name: inputName,
                        type: PropertyType.Any
                    });
                }
            }
        },
        icon: (
            <svg viewBox="0 0 22.556997299194336 17.176000595092773">
                <path d="M4.912.27h3.751v10.514c0 4.738-2.271 6.392-5.899 6.392-.888 0-2.024-.148-2.764-.395l.42-3.036a6.18 6.18 0 0 0 1.925.296c1.58 0 2.567-.716 2.567-3.282V.27zm7.008 12.785c.987.518 2.567 1.037 4.171 1.037 1.728 0 2.641-.716 2.641-1.826 0-1.012-.79-1.629-2.789-2.32-2.764-.987-4.59-2.517-4.59-4.961C11.353 2.147 13.747 0 17.646 0c1.9 0 3.258.37 4.245.839l-.839 3.011a7.779 7.779 0 0 0-3.455-.79c-1.629 0-2.419.765-2.419 1.604 0 1.061.913 1.53 3.085 2.369 2.937 1.086 4.294 2.616 4.294 4.985 0 2.789-2.122 5.158-6.688 5.158-1.9 0-3.776-.518-4.714-1.037l.765-3.085z" />
            </svg>
        ),
        componentHeaderColor: "#A6BBCF"
    });

    @observable expression: string;

    static readonly PARAMS_REGEXP = /\{([^\}]+)\}/;

    static parse(expression: string) {
        const inputs = new Set<string>();

        if (expression) {
            EvalJSExprActionComponent.PARAMS_REGEXP.lastIndex = 0;
            let str = expression;
            while (true) {
                let matches = str.match(
                    EvalJSExprActionComponent.PARAMS_REGEXP
                );
                if (!matches) {
                    break;
                }
                const input = matches[1].trim();
                inputs.add(input);
                str = str.substring(matches.index! + matches[1].length);
            }
        }

        return Array.from(inputs.keys());
    }

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            }
        ];
    }

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            {
                name: "result",
                type: "any",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>{this.expression}</pre>
            </div>
        );
    }

    expandExpression(flowState: FlowState) {
        let jsEvalExpression = this.expression;
        let values: any = {};

        EvalJSExprActionComponent.parse(jsEvalExpression).forEach(
            (expression, i) => {
                const value = flowState.evalExpression(this, expression);
                const name = `_val${i}`;
                values[name] = value;
                jsEvalExpression = jsEvalExpression.replace(
                    new RegExp(`\{${expression}\}`, "g"),
                    `values.${name}`
                );
            }
        );

        return { jsEvalExpression, values };
    }

    async execute(flowState: FlowState) {
        const { jsEvalExpression, values } = this.expandExpression(flowState);
        values;
        let result = (0, eval)(jsEvalExpression);
        flowState.runtime.propagateValue(flowState, this, "result", result);
        return undefined;
    }
}

registerClass("EvalJSExprActionComponent", EvalJSExprActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class SetVariableActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1007,

        properties: [
            makeAssignableExpressionProperty(
                {
                    name: "variable",
                    type: PropertyType.String,
                    propertyGridGroup: specificGroup
                },
                "any"
            ),
            makeExpressionProperty(
                {
                    name: "value",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "any"
            )
        ],
        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M5 9h14m-14 6h14"></path>
            </svg>
        ),
        componentHeaderColor: "#A6BBCF"
    });

    @observable variable: string;
    @observable value: string;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            }
        ];
    }

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>
                    {this.variable}
                    <LeftArrow />
                    {this.value}
                </pre>
            </div>
        );
    }

    async execute(flowState: FlowState) {
        let value = flowState.evalExpression(this, this.value);

        flowState.runtime.assignValue(flowState, this, this.variable, value);

        return undefined;
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        buildAssignableExpression(assets, dataBuffer, this, this.variable);
    }
}

registerClass("SetVariableActionComponent", SetVariableActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class WatchVariableActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1005,
        properties: [
            makeExpressionProperty(
                {
                    name: "variable",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "any"
            )
        ],
        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <circle cx="12" cy="12" r="2"></circle>
                <path d="M22 12c-2.667 4.667 -6 7 -10 7s-7.333 -2.333 -10 -7c2.667 -4.667 6 -7 10 -7s7.333 2.333 10 7"></path>
            </svg>
        ),
        componentHeaderColor: "#A6BBCF"
    });

    @observable variable: string;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            }
        ];
    }

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            {
                name: "variable",
                displayName: (component: WatchVariableActionComponent) =>
                    component.variable,
                type: "any",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }

    async execute(
        flowState: FlowState,
        dispose: (() => void) | undefined
    ): Promise<(() => void) | undefined | boolean> {
        let lastValue = flowState.evalExpression(this, this.variable);

        flowState.runtime.propagateValue(
            flowState,
            this,
            "variable",
            lastValue
        );

        if (dispose) {
            return dispose;
        }

        return reaction(
            () => flowState.evalExpression(this, this.variable),
            value => {
                if (value !== lastValue) {
                    lastValue = value;
                    flowState.runtime.propagateValue(
                        flowState,
                        this,
                        "variable",
                        value
                    );
                }
            }
        );
    }
}

registerClass("WatchVariableActionComponent", WatchVariableActionComponent);

////////////////////////////////////////////////////////////////////////////////

class SwitchTest extends EezObject {
    @observable condition: string;
    @observable outputName: string;

    static classInfo: ClassInfo = {
        properties: [
            makeExpressionProperty(
                {
                    name: "condition",
                    type: PropertyType.MultilineText
                },
                "boolean"
            ),
            {
                name: "outputName",
                type: PropertyType.String,
                unique: componentOutputUnique
            }
        ],
        check: (switchTest: SwitchTest) => {
            let messages: Message[] = [];
            try {
                checkExpression(
                    getParent(getParent(switchTest)!)! as Component,
                    switchTest.condition,
                    false
                );
            } catch (err) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid expression: ${err}`,
                        getChildOfObject(switchTest, "condition")
                    )
                );
            }
            return messages;
        },
        defaultValue: {}
    };
}

export class SwitchActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1008,

        properties: [
            {
                name: "tests",
                type: PropertyType.Array,
                typeClass: SwitchTest,
                propertyGridGroup: specificGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            }
        ],
        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M8 8a3.5 3 0 0 1 3.5 -3h1a3.5 3 0 0 1 3.5 3a3 3 0 0 1 -2 3a3 4 0 0 0 -2 4"></path>
                <line x1="12" y1="19" x2="12" y2="19.01"></line>
            </svg>
        ),
        componentHeaderColor: "#AAAA66",
        defaultValue: {}
    });

    @observable tests: SwitchTest[];

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            }
        ];
    }

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...this.tests
                .filter(test => !!test.outputName)
                .map(test => ({
                    name: test.outputName,
                    type: "null" as ValueType,
                    isSequenceOutput: true,
                    isOptionalOutput: false
                }))
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                {this.tests.map(test => (
                    <pre key={test.outputName}>{test.condition}</pre>
                ))}
            </div>
        );
    }

    async execute(flowState: FlowState) {
        for (const test of this.tests) {
            let value = flowState.evalExpression(this, test.condition);
            if (value) {
                flowState.runtime.propagateValue(
                    flowState,
                    this,
                    test.outputName,
                    null
                );
                break;
            }
        }
        return undefined;
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeArray(this.tests, test => {
            dataBuffer.writeUint8(
                this.buildOutputs.findIndex(
                    output => output.name == test.outputName
                )
            );
            buildExpression(assets, dataBuffer, this, test.condition);
        });
    }
}

registerClass("SwitchActionComponent", SwitchActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class CompareActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1009,
        properties: [
            makeExpressionProperty(
                {
                    name: "A",
                    displayName: "A",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "any"
            ),
            makeExpressionProperty(
                {
                    name: "B",
                    displayName: "B",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (object: CompareActionComponent) => {
                        return object.operator == "NOT";
                    }
                },
                "any"
            ),
            makeExpressionProperty(
                {
                    name: "C",
                    displayName: "C",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (object: CompareActionComponent) => {
                        return object.operator !== "BETWEEN";
                    }
                },
                "any"
            ),
            {
                name: "operator",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "=", label: "=" },
                    { id: "<", label: "<" },
                    { id: ">", label: ">" },
                    { id: "<=", label: "<=" },
                    { id: ">=", label: ">=" },
                    { id: "<>", label: "<>" },
                    { id: "NOT", label: "NOT" },
                    { id: "AND", label: "AND" },
                    { id: "OR", label: "OR" },
                    { id: "XOR", label: "XOR" },
                    { id: "BETWEEN", label: "BETWEEN" }
                ],
                propertyGridGroup: specificGroup
            }
        ],
        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M8 8a3.5 3 0 0 1 3.5 -3h1a3.5 3 0 0 1 3.5 3a3 3 0 0 1 -2 3a3 4 0 0 0 -2 4"></path>
                <line x1="12" y1="19" x2="12" y2="19.01"></line>
            </svg>
        ),
        componentHeaderColor: "#AAAA66",
        defaultValue: {
            operator: "="
        }
    });

    @observable A: string;
    @observable B: string;
    @observable C: string;
    @observable operator: string;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            }
        ];
    }

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "True",
                type: "null",
                isSequenceOutput: true,
                isOptionalOutput: outputIsOptionalIfAtLeastOneOutputExists
            },
            {
                name: "False",
                type: "null",
                isSequenceOutput: true,
                isOptionalOutput: outputIsOptionalIfAtLeastOneOutputExists
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        if (this.operator == "NOT") {
            return (
                <div className="body">
                    <pre>
                        {" NOT "}
                        {this.isInputProperty("A") ? "A" : this.A}
                    </pre>
                </div>
            );
        }

        if (this.operator == "BETWEEN") {
            return (
                <div className="body">
                    <pre>
                        {this.isInputProperty("B") ? "B" : this.B} {" <= "}
                        {this.isInputProperty("A") ? "A" : this.A} {" <= "}
                        {this.isInputProperty("C") ? "C" : this.C}
                    </pre>
                </div>
            );
        }

        return (
            <div className="body">
                <pre>
                    {this.isInputProperty("A") ? "A" : this.A} {this.operator}{" "}
                    {this.isInputProperty("B") ? "B" : this.B}
                </pre>
            </div>
        );
    }

    async execute(flowState: FlowState) {
        let result;
        let A = flowState.evalExpression(this, this.A);

        if (this.operator == "NOT") {
            result = !A;
        } else {
            let B = flowState.evalExpression(this, this.B);
            if (this.operator === "=") {
                result = A === B;
            } else if (this.operator === "<") {
                result = A < B;
            } else if (this.operator === ">") {
                result = A > B;
            } else if (this.operator === "<=") {
                result = A <= B;
            } else if (this.operator === ">=") {
                result = A >= B;
            } else if (this.operator === "<>") {
                result = A !== B;
            } else if (this.operator === "AND") {
                result = A && B;
            } else if (this.operator === "OR") {
                result = A || B;
            } else if (this.operator === "XOR") {
                result = A ? !B : B;
            } else if (this.operator === "BETWEEN") {
                let C = flowState.evalExpression(this, this.C);
                result = A >= B && A <= C;
            }
        }

        if (result) {
            flowState.runtime.propagateValue(flowState, this, "True", true);
        } else {
            flowState.runtime.propagateValue(flowState, this, "False", false);
        }
        return undefined;
    }
}

registerClass("CompareActionComponent", CompareActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class IsTrueActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1010,
        properties: [
            makeExpressionProperty(
                {
                    name: "value",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "boolean"
            )
        ],
        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M5 12l5 5l10 -10"></path>
            </svg>
        ),
        componentHeaderColor: "#AAAA66",
        defaultValue: {
            value: "value",
            customInputs: [
                {
                    name: "value",
                    type: "any"
                }
            ]
        }
    });

    @observable value: any;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            }
        ];
    }

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "True",
                displayName: "Yes",
                type: "null",
                isSequenceOutput: true,
                isOptionalOutput: outputIsOptionalIfAtLeastOneOutputExists
            },
            {
                name: "False",
                displayName: "No",
                type: "null",
                isSequenceOutput: true,
                isOptionalOutput: outputIsOptionalIfAtLeastOneOutputExists
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        if (
            this.customInputs.length == 1 &&
            this.customInputs[0].name == this.value
        ) {
            return null;
        }

        return (
            <div className="body">
                <pre>{this.value}</pre>
            </div>
        );
    }

    async execute(flowState: FlowState) {
        let value = flowState.evalExpression(this, this.value);

        if (value) {
            flowState.runtime.propagateValue(flowState, this, "True", true);
        } else {
            flowState.runtime.propagateValue(flowState, this, "False", false);
        }
        return undefined;
    }
}

registerClass("IsTrueActionComponent", IsTrueActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ConstantActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1011,

        properties: [
            makeExpressionProperty(
                {
                    name: "value",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    expressionIsConstant: true
                },
                "string"
            )
        ],
        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <rect x="7" y="3" width="14" height="14" rx="2"></rect>
                <path d="M17 17v2a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2"></path>
                <path d="M14 14v-8l-2 2"></path>
            </svg>
        ),
        componentHeaderColor: "#C0C0C0"
    });

    @observable value: string;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            }
        ];
    }

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            {
                name: "value",
                displayName: this.value,
                type: "any",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }

    async execute(flowState: FlowState) {
        flowState.runtime.propagateValue(
            flowState,
            this,
            "value",
            evalConstantExpression(ProjectEditor.getProject(this), this.value)
        );
        return undefined;
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        try {
            dataBuffer.writeUint16(
                assets.getConstantIndex(
                    evalConstantExpression(assets.rootProject, this.value)
                )
            );
        } catch (err) {
            assets.DocumentStore.outputSectionsStore.write(
                Section.OUTPUT,
                MessageType.ERROR,
                err.toString(),
                getChildOfObject(this, "value")
            );
            dataBuffer.writeUint16(assets.getConstantIndex(null));
        }
    }
}

registerClass("ConstantActionComponent", ConstantActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class DateNowActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        icon: (
            <svg viewBox="0 0 36 40">
                <path d="M12 18H8v4h4v-4zm8 0h-4v4h4v-4zm8 0h-4v4h4v-4zm4-14h-2V0h-4v4H10V0H6v4H4C1.78 4 .02 5.8.02 8L0 36c0 2.2 1.78 4 4 4h28c2.2 0 4-1.8 4-4V8c0-2.2-1.8-4-4-4zm0 32H4V14h28v22z" />
            </svg>
        ),
        componentHeaderColor: "#C0C0C0"
    });

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "value",
                type: "date",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }

    async execute(flowState: FlowState) {
        flowState.runtime.propagateValue(flowState, this, "value", Date.now());
        return undefined;
    }
}

registerClass("DateNowActionComponent", DateNowActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ReadSettingActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            makeExpressionProperty(
                {
                    name: "key",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            )
        ],
        icon: (
            <svg viewBox="0 0 1100 1179">
                <path d="M135 156L277 14q14-14 35-14t35 14l77 77-212 212-77-76q-14-15-14-36t14-35zm520 168l210-210q14-14 24.5-10t10.5 25l-2 599q-1 20-15.5 35T847 778l-597 1q-21 0-25-10.5t10-24.5l208-208-154-155 212-212zM50 879h1000q21 0 35.5 14.5T1100 929v250H0V929q0-21 14.5-35.5T50 879zm850 100v50h100v-50H900z" />
            </svg>
        ),
        componentHeaderColor: "#C0DEED"
    });

    @observable key: string;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            }
        ];
    }

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: false
            },
            {
                name: "value",
                type: "any",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        let key;
        if (flowContext.flowState) {
            key = flowContext.flowState.evalExpression(this, this.key);
        } else {
            key = this.key;
        }

        return key ? (
            <div className="body">
                <pre>{key}</pre>
            </div>
        ) : null;
    }

    async execute(flowState: FlowState) {
        let key = flowState.evalExpression(this, this.key);
        flowState.runtime.propagateValue(
            flowState,
            this,
            "value",
            flowState.runtime.readSettings(key)
        );
        return undefined;
    }
}

registerClass("ReadSettingActionComponent", ReadSettingActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class WriteSettingsActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            makeExpressionProperty(
                {
                    name: "key",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "value",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "any"
            )
        ],
        icon: (
            <svg viewBox="0 0 1100 1200">
                <path d="M350 0l599 2q20 1 35 15.5T999 53l1 597q0 21-10.5 25T965 665L757 457 602 611 390 399l155-154L335 35q-14-14-10-24.5T350 0zm174 688l-76 77q-15 14-36 14t-35-14L235 623q-14-14-14-35t14-35l77-77zM50 900h1000q21 0 35.5 14.5T1100 950v250H0V950q0-21 14.5-35.5T50 900zm850 100v50h100v-50H900z" />
            </svg>
        ),
        componentHeaderColor: "#C0DEED"
    });

    @observable key: string;
    @observable value: string;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            }
        ];
    }

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: false
            }
        ];
    }

    async execute(flowState: FlowState) {
        let key = flowState.evalExpression(this, this.key);
        let value = flowState.evalExpression(this, this.value);
        flowState.runtime.writeSettings(key, value);
        return undefined;
    }
}

registerClass("WriteSettingsActionComponent", WriteSettingsActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class LogActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1012,
        properties: [
            makeExpressionProperty(
                {
                    name: "value",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            )
        ],
        beforeLoadHook: (object: LogActionComponent, objectJS: any) => {
            if (
                !objectJS.hasOwnProperty("value") &&
                objectJS.customInputs == undefined
            ) {
                objectJS.customInputs = [
                    {
                        name: "value",
                        type: "string"
                    }
                ];
                objectJS.value = "value";
            }
        },
        icon: (
            <svg viewBox="0 0 448 448">
                <path d="M223.988 0C128.473 0 46.934 59.804 14.727 144h34.639c9.396-20.484 22.457-39.35 38.868-55.762C124.497 51.973 172.709 32 223.988 32c51.286 0 99.504 19.973 135.771 56.239C396.027 124.505 416 172.719 416 224c0 51.285-19.973 99.501-56.239 135.765C323.494 396.029 275.275 416 223.988 416c-51.281 0-99.493-19.971-135.755-56.234C71.821 343.354 58.76 324.486 49.362 304H14.725c32.206 84.201 113.746 144 209.264 144C347.703 448 448 347.715 448 224 448 100.298 347.703 0 223.988 0z" />
                <path d="M174.863 291.883l22.627 22.627L288 224l-90.51-90.51-22.628 22.628L226.745 208H0v32h226.745z" />
            </svg>
        ),
        componentHeaderColor: "#C0DEED"
    });

    @observable value: string;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            }
        ];
    }

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            }
        ];
    }

    async execute(flowState: FlowState) {
        const value = flowState.evalExpression(this, this.value);
        flowState.logInfo(value, this);
        return undefined;
    }
}

registerClass("LogActionComponent", LogActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class CallActionActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1013,

        properties: [
            makeExpressionProperty(
                {
                    name: "action",
                    type: PropertyType.ObjectReference,
                    referencedObjectCollectionPath: "actions",
                    propertyGridGroup: specificGroup,
                    onSelect: (
                        object: IEezObject,
                        propertyInfo: PropertyInfo
                    ) =>
                        onSelectItem(object, propertyInfo, {
                            title: propertyInfo.onSelectTitle!,
                            width: 800
                        }),
                    onSelectTitle: "Select Action"
                },
                "string"
            )
        ],
        label: (component: CallActionActionComponent) => {
            if (!component.action) {
                return ActionComponent.classInfo.label!(component);
            }
            return component.action;
        },
        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M7 4a12.25 12.25 0 0 0 0 16"></path>
                <path d="M17 4a12.25 12.25 0 0 1 0 16"></path>
            </svg>
        ),
        componentHeaderColor: "#C7E9C0",
        open: (object: CallActionActionComponent) => {
            object.open();
        },
        check: (component: CallActionActionComponent) => {
            let messages: Message[] = [];

            if (!component.action) {
                messages.push(propertyNotSetMessage(component, "action"));
            } else {
                const action = findAction(
                    getProject(component),
                    component.action
                );
                if (!action) {
                    if (!component.isInputProperty(component.action)) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Action "${component.action}" not found`,
                                getChildOfObject(component, "action")
                            )
                        );
                    }
                }
            }

            return messages;
        }
    });

    @observable action: string;

    getInputs(): ComponentInput[] {
        let inputs: ComponentInput[];

        const action = findAction(getProject(this), this.action);
        if (action) {
            inputs = action.inputComponents.map(
                (inputActionComponent: InputActionComponent) => ({
                    name: inputActionComponent.wireID,
                    displayName: inputActionComponent.name
                        ? inputActionComponent.name
                        : NOT_NAMED_LABEL,
                    type: "any",
                    isSequenceInput: false,
                    isOptionalInput: false
                })
            );
        } else {
            inputs = [];
        }

        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            },
            ...inputs
        ];
    }

    getOutputs() {
        let outputs: ComponentOutput[];

        const action = findAction(getProject(this), this.action);
        if (action) {
            outputs = action.outputComponents.map(
                (outputActionComponent: OutputActionComponent) => ({
                    name: outputActionComponent.wireID,
                    displayName: outputActionComponent.name
                        ? outputActionComponent.name
                        : NOT_NAMED_LABEL,
                    type: "any",
                    isSequenceOutput: false,
                    isOptionalOutput: true
                })
            );
        } else {
            outputs = [];
        }

        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...outputs
        ];
    }

    async execute(flowState: FlowState) {
        const actionName = flowState.getPropertyValue(this, "action");
        const action = findAction(getProject(this), actionName);
        if (!action) {
            return;
        }

        const actionFlowState = new FlowState(
            flowState.runtime,
            action,
            flowState,
            this
        );
        flowState.flowStates.push(actionFlowState);

        actionFlowState.runtime.startFlow(actionFlowState);

        const componentState = flowState.getComponentState(this);
        for (let [input, inputData] of componentState.inputsData) {
            for (let component of action.components) {
                if (component instanceof InputActionComponent) {
                    if (component.wireID === input) {
                        actionFlowState.runtime.propagateValue(
                            actionFlowState,
                            component,
                            "@seqout",
                            inputData
                        );
                    }
                }
            }
        }

        if (actionFlowState.numActiveComponents == 0) {
            actionFlowState.isFinished = true;
            flowState.runtime.propagateValue(flowState, this, "@seqout", null);
        } else {
            actionFlowState.numActiveComponents++;
        }

        return false;
    }

    open() {
        const action = findAction(getProject(this), this.action);
        if (action) {
            getDocumentStore(this).navigationStore.showObject(action);
        }
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        const action = findAction(getProject(this), this.action);
        if (action) {
            const flowIndex = assets.flows.indexOf(action);
            dataBuffer.writeInt16(flowIndex);

            if (action.inputComponents.length > 0) {
                dataBuffer.writeUint8(
                    this.buildInputs.findIndex(
                        input => input.name == action.inputComponents[0].wireID
                    )
                );
            } else {
                dataBuffer.writeUint8(0);
            }

            if (action.outputComponents.length > 0) {
                dataBuffer.writeUint8(
                    this.buildOutputs.findIndex(
                        output =>
                            output.name == action.outputComponents[0].wireID
                    )
                );
            } else {
                dataBuffer.writeUint8(0);
            }
        } else {
            dataBuffer.writeInt16(-1);
            dataBuffer.writeUint8(0);
            dataBuffer.writeUint8(0);
        }
    }
}

registerClass("CallActionActionComponent", CallActionActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class DelayActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1014,
        properties: [
            makeExpressionProperty(
                {
                    name: "milliseconds",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            )
        ],
        icon: (
            <svg viewBox="0 0 10 10">
                <path d="M7.5 5.1c0 .3-.2.5-.5.5H5c-.3 0-.5-.2-.5-.5v-2c0-.3.2-.5.5-.5s.5.2.5.5v1.5H7c.2 0 .5.3.5.5zM10 5c0-2.8-2.2-5-5-5S0 2.2 0 5s2.2 5 5 5 5-2.2 5-5zM9 5c0 2.2-1.8 4-4 4S1 7.2 1 5s1.8-4 4-4 4 1.8 4 4z" />
            </svg>
        ),
        componentHeaderColor: "#E6E0F8"
    });

    @observable milliseconds: string;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            }
        ];
    }

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: false
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>{this.milliseconds} ms</pre>
            </div>
        );
    }

    async execute(flowState: FlowState) {
        const milliseconds = flowState.evalExpression(this, this.milliseconds);
        await new Promise<void>(resolve =>
            setTimeout(resolve, milliseconds ?? 0)
        );
        return undefined;
    }
}

registerClass("DelayActionComponent", DelayActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ErrorActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1015,
        properties: [
            makeExpressionProperty(
                {
                    name: "message",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            )
        ],
        icon: (
            <svg viewBox="0 0 40 40">
                <path d="M18 26h4v4h-4zm0-16h4v12h-4zm1.99-10C8.94 0 0 8.95 0 20s8.94 20 19.99 20S40 31.05 40 20 31.04 0 19.99 0zM20 36c-8.84 0-16-7.16-16-16S11.16 4 20 4s16 7.16 16 16-7.16 16-16 16z" />
            </svg>
        ),
        componentHeaderColor: "#fc9b9b"
    });

    @observable message: string;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        if (this.isInputProperty("message")) {
            return null;
        }
        return (
            <div className="body">
                <pre>{this.message}</pre>
            </div>
        );
    }

    async execute(flowState: FlowState) {
        const message = flowState.evalExpression(this, this.message);
        throw message;
        return undefined;
    }
}

registerClass("ErrorActionComponent", ErrorActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class CatchErrorActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1016,
        properties: [],
        icon: (
            <svg viewBox="0 0 40 40">
                <path d="M20 0C8.96 0 0 8.95 0 20s8.96 20 20 20 20-8.95 20-20S31.04 0 20 0zm2 30h-4v-4h4v4zm0-8h-4V10h4v12z" />
            </svg>
        ),
        componentHeaderColor: "#FFAAAA"
    });

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            {
                name: "Message",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }

    async execute(flowState: FlowState) {
        const messageInputValue = flowState.getInputValue(this, "message");
        flowState.runtime.propagateValue(
            flowState,
            this,
            "Message",
            messageInputValue ?? "unknow error"
        );

        return undefined;
    }
}

registerClass("CatchErrorActionComponent", CatchErrorActionComponent);

////////////////////////////////////////////////////////////////////////////////

class CounterRunningState {
    constructor(public value: number) {}
}

export class CounterActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1017,
        properties: [
            {
                name: "countValue",
                type: PropertyType.String
            }
        ],
        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M9 4.55a8 8 0 0 1 6 14.9m0 -4.45v5h5"></path>
                <line x1="5.63" y1="7.16" x2="5.63" y2="7.17"></line>
                <line x1="4.06" y1="11" x2="4.06" y2="11.01"></line>
                <line x1="4.63" y1="15.1" x2="4.63" y2="15.11"></line>
                <line x1="7.16" y1="18.37" x2="7.16" y2="18.38"></line>
                <line x1="11" y1="19.94" x2="11" y2="19.95"></line>
            </svg>
        ),
        componentHeaderColor: "#E2D96E"
    });

    @observable countValue: number;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            }
        ];
    }

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: false
            },
            {
                name: "done",
                type: "null",
                isSequenceOutput: true,
                isOptionalOutput: true
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>{this.countValue}</pre>
            </div>
        );
    }

    async execute(flowState: FlowState) {
        let counterRunningState =
            flowState.getComponentRunningState<CounterRunningState>(this);

        if (!counterRunningState) {
            counterRunningState = new CounterRunningState(this.countValue);
            flowState.setComponentRunningState(this, counterRunningState);
        }

        if (counterRunningState.value == 0) {
            flowState.runtime.propagateValue(flowState, this, "done", null);
            flowState.setComponentRunningState(this, undefined);
        } else {
            counterRunningState.value--;
        }

        return undefined;
    }
}

registerClass("CounterActionComponent", CounterActionComponent);

////////////////////////////////////////////////////////////////////////////////

class LoopRunningState {
    constructor(public value: number, public to: number, public step: number) {}
}

export class LoopActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1018,

        properties: [
            makeAssignableExpressionProperty(
                {
                    name: "variable",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "from",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "to",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "step",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            )
        ],
        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M9 4.55a8 8 0 0 1 6 14.9m0 -4.45v5h5"></path>
                <line x1="5.63" y1="7.16" x2="5.63" y2="7.17"></line>
                <line x1="4.06" y1="11" x2="4.06" y2="11.01"></line>
                <line x1="4.63" y1="15.1" x2="4.63" y2="15.11"></line>
                <line x1="7.16" y1="18.37" x2="7.16" y2="18.38"></line>
                <line x1="11" y1="19.94" x2="11" y2="19.95"></line>
            </svg>
        ),
        componentHeaderColor: "#E2D96E",
        defaultValue: {
            from: "0",
            step: "1"
        }
    });

    @observable variable: string;
    @observable from: string;
    @observable to: string;
    @observable step: string;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "start",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            },
            {
                name: "next",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            }
        ];
    }

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: false
            },
            {
                name: "done",
                type: "null",
                isSequenceOutput: true,
                isOptionalOutput: true
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>
                    {this.variable} <LeftArrow />[ {this.from} ... {this.to}{" "}
                    &gt;
                    {this.step !== "1" ? ` step ${this.step}` : ""}
                </pre>
            </div>
        );
    }

    async execute(flowState: FlowState) {
        let runningState =
            flowState.getComponentRunningState<LoopRunningState>(this);

        const componentState = flowState.getComponentState(this);
        if (componentState.inputsData.has("start")) {
            runningState = undefined;
        } else {
            runningState = componentState.runningState;
        }

        if (!runningState) {
            runningState = new LoopRunningState(
                flowState.evalExpression(this, this.from),
                flowState.evalExpression(this, this.to),
                flowState.evalExpression(this, this.step)
            );
            flowState.setComponentRunningState(this, runningState);
            flowState.runtime.assignValue(
                flowState,
                this,
                this.variable,
                runningState.value
            );
        } else {
            runningState.value += runningState.step;

            if (runningState.value >= runningState.to) {
                flowState.runtime.propagateValue(flowState, this, "done", null);
                flowState.setComponentRunningState(this, undefined);
                return false;
            } else {
                flowState.runtime.assignValue(
                    flowState,
                    this,
                    this.variable,
                    runningState.value
                );
            }
        }

        return undefined;
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        buildAssignableExpression(assets, dataBuffer, this, this.variable);
    }
}

registerClass("LoopActionComponent", LoopActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ShowPageActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1019,
        properties: [
            {
                name: "page",
                type: PropertyType.String
            }
        ],
        icon: (
            <svg viewBox="0 0 36 36">
                <path d="M0 20h16V0H0v20zm0 16h16V24H0v12zm20 0h16V16H20v20zm0-36v12h16V0H20z" />
            </svg>
        ),
        componentHeaderColor: "#DEB887"
    });

    @observable page: string;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            }
        ];
    }

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>{this.page}</pre>
            </div>
        );
    }

    async execute(flowState: FlowState) {
        if (!this.page) {
            throw "page not specified";
        }
        const page = findPage(
            flowState.runtime.DocumentStore.project,
            this.page
        );
        if (!page) {
            throw "page not found";
        }

        runInAction(() => {
            flowState.runtime.selectedPage = page;
        });

        return undefined;
    }
}

registerClass("ShowPageActionComponent", ShowPageActionComponent);

////////////////////////////////////////////////////////////////////////////////

const TrixEditor = observer(
    ({
        component,
        flowContext,
        value,
        setValue
    }: {
        component: CommentActionComponent;
        flowContext: IFlowContext;
        value: string;
        setValue: (value: string) => void;
    }) => {
        const inputId = React.useMemo<string>(() => guid(), []);
        const editorId = React.useMemo<string>(() => guid(), []);

        React.useEffect(() => {
            const trixEditor = document.getElementById(editorId) as HTMLElement;

            if (value != trixEditor.innerHTML) {
                (trixEditor as any).editor.loadHTML(value);
            }

            const onChange = () => {
                const geometry = calcComponentGeometry(
                    component,
                    trixEditor.closest(".EezStudio_ComponentEnclosure")!,
                    flowContext
                );

                runInAction(() => {
                    component.geometry = geometry;
                });
            };
            const onFocus = () => {
                const trixToolbar =
                    trixEditor.parentElement?.querySelector("trix-toolbar");
                if (trixToolbar instanceof HTMLElement) {
                    trixToolbar.style.visibility = "visible";
                }

                if (trixEditor.innerHTML != value) {
                    setValue(trixEditor.innerHTML);
                }
            };
            const onBlur = () => {
                const trixToolbar =
                    trixEditor.parentElement?.querySelector("trix-toolbar");
                if (trixToolbar instanceof HTMLElement) {
                    trixToolbar.style.visibility = "";
                }

                if (trixEditor.innerHTML != value) {
                    setValue(trixEditor.innerHTML);
                }
            };
            trixEditor.addEventListener("trix-change", onChange, false);
            trixEditor.addEventListener("trix-focus", onFocus, false);
            trixEditor.addEventListener("trix-blur", onBlur, false);

            return () => {
                trixEditor.removeEventListener("trix-change", onChange, false);
                trixEditor.removeEventListener("trix-focus", onFocus, false);
                trixEditor.removeEventListener("trix-blur", onBlur, false);
            };
        }, [value]);

        var attributes: { [key: string]: string } = {
            id: editorId,
            input: inputId
        };

        return (
            <div
                className="eez-flow-editor-capture-pointers EezStudio_TrixEditor"
                tabIndex={0}
            >
                {React.createElement("trix-editor", attributes)}
                <input id={inputId} value={value ?? ""} type="hidden"></input>
            </div>
        );
    }
);

export class CommentActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        label: () => "",

        properties: [
            {
                name: "text",
                type: PropertyType.String,
                hideInPropertyGrid: true
            }
        ],
        icon: (
            <svg viewBox="0 0 14 13.5">
                <path d="M13 0H1C.45 0 0 .45 0 1v8c0 .55.45 1 1 1h2v3.5L6.5 10H13c.55 0 1-.45 1-1V1c0-.55-.45-1-1-1zm0 9H6l-2 2V9H1V1h12v8z" />
            </svg>
        ),
        componentHeaderColor: "#fff5c2",
        isFlowExecutableComponent: false,
        getResizeHandlers(object: CommentActionComponent) {
            return object.getResizeHandlers();
        },
        defaultValue: {
            left: 0,
            top: 0,
            width: 435,
            height: 134
        }
    });

    @observable text: string;

    get autoSize(): AutoSize {
        return "height";
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        return [
            {
                x: 0,
                y: 50,
                type: "w-resize"
            },
            {
                x: 100,
                y: 50,
                type: "e-resize"
            }
        ];
    }

    getClassName() {
        return classNames(
            super.getClassName(),
            "EezStudio_CommentActionComponent"
        );
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <TrixEditor
                component={this}
                flowContext={flowContext}
                value={this.text}
                setValue={action((value: string) => {
                    const DocumentStore = getDocumentStore(this);
                    DocumentStore.updateObject(this, {
                        text: value
                    });
                })}
            ></TrixEditor>
        );
    }
}

registerClass("CommentActionComponent", CommentActionComponent);