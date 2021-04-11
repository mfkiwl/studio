import React from "react";
import mobx from "mobx";
import { ThemedStyledInterface } from "styled-components";

interface IEezObject {}

interface PropertyInfo {
    name: string;
    displayName?: string;
    type: any;
    hideInPropertyGrid?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);
}

interface ClassInfo {
    properties: PropertyInfo[];
    icon?: React.ReactNode;
}

declare class Component {
    static classInfo: ClassInfo;

    get inputProperties(): PropertyInfo[];
    get inputs(): PropertyInfo[];

    get outputProperties(): PropertyInfo[];
    get outputs(): PropertyInfo[];

    onStart(runningFlow: IRunningFlow): void;
    onFinish(runningFlow: IRunningFlow): void;
}

declare class ActionComponent extends Component {
    getBody(flowContext: IFlowContext): React.ReactNode;
    execute(runningFlow: IRunningFlow): Promise<void>;
}

interface IFlowContext {
    dataContext: IDataContext;
    runningFlow?: IRunningFlow;
    document: any;
    viewState: any;
    editorOptions: any;
    frontFace: boolean;

    overrideDataContext(dataContextOverridesObject: any): IFlowContext;
    overrideRunningFlow(component: Component): IFlowContext;
}

interface InputData {
    time: number;
    value: any;
}

type InputPropertyValue = InputData;

interface IRunningFlow {
    getRunningFlowByComponent(component: Component): IRunningFlow | undefined;

    getInputValue(component: Component, input: string): any;
    getPropertyValue(component: Component, propertyName: string): any;
    getInputPropertyValue(
        component: Component,
        input: string
    ): InputPropertyValue | undefined;

    getComponentRunningState<T>(component: Component): T;
    setComponentRunningState<T>(component: Component, runningState: T): void;

    dataContext: IDataContext;

    getVariable(component: Component, variableName: string): any;
    setVariable(component: Component, variableName: string, value: any): void;
    declareVariable(
        component: Component,
        variableName: string,
        value: any
    ): void;

    propagateValue(
        sourceComponent: Component,
        output: string,
        value: any
    ): void;
}

interface IDataContext {
    createWithDefaultValueOverrides(defaultValueOverrides: any): IDataContext;
    createWithLocalVariables(): IDataContext;

    get(dataItemId: string): any;
    set(dataItemId: string, value: any): void;
    declare(dataItemId: string, value: any): void;

    getEnumValue(dataItemId: string): number;
    getBool(dataItemId: string): boolean;
    getValueList(dataItemId: string): string[];
    getMin(dataItemId: string): number;
    getMax(dataItemId: string): number;
}

interface ThemeInterface {
    borderColor: string;
    darkBorderColor: string;
    panelHeaderColor: string;
    selectionBackgroundColor: string;
    selectionColor: string;
    lightSelectionBackgroundColor: string;
    lightSelectionColor: string;
    tableBorderColor: string;
    nonFocusedSelectionBackgroundColor: string;
    nonFocusedSelectionColor: string;
    hoverBackgroundColor: string;
    hoverColor: string;
    scrollTrackColor: string;
    scrollThumbColor: string;
    darkTextColor: string;
    focusBackgroundColor: string;
    focusColor: string;
    dragSourceBackgroundColor: string;
    dragSourceColor: string;
    dropTargetBackgroundColor: string;
    dropTargetColor: string;
    dropPlaceColor: string;
    errorColor: string;
    actionTextColor: string;
    actionHoverColor: string;
    connectionLineColor: string;
    selectedConnectionLineColor: string;
    activeConnectionLineColor: string;
    connectionLineInTheMakingColor: string;
}

interface IEezStudio {
    React: typeof React;
    mobx: typeof mobx;
    styled: ThemedStyledInterface<ThemeInterface>;
    registerClass: (classToRegister: any) => void;
    PropertyType: any;
    makeDerivedClassInfo: (
        baseClassInfo: ClassInfo,
        derivedClassInfoProperties: Partial<ClassInfo>
    ) => ClassInfo;
    ActionComponent: typeof ActionComponent;
}