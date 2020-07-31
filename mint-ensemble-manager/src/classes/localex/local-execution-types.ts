import { ExecutableEnsemble } from "../mint/mint-types";

export interface ComponentSeed {
    component: Component,
    ensemble: ExecutableEnsemble,
    datasets: ComponentDataBindings,
    parameters: ComponentParameterBindings,
    paramtypes: ComponentParameterTypes,
}

export interface ComponentDataBindings {
    [inputid: string] : string[]
}
export interface ComponentParameterBindings {
    [inputid: string] : string
}
export interface ComponentParameterTypes {
    [inputid: string] : string
}

export interface Component {
    rundir: string,
    softwareImage?: string,
    inputs: ComponentArgument[],
    outputs: ComponentArgument[]
}

export interface ComponentArgument {
    type: string,
    role: string,
    prefix: string,
    isParam?: boolean,
    dimensionality?: number,
    paramDefaultValue?: any,
    testValue?: string
}