import {
    ComponentArgument,
    ComponentDataBindings,
    ComponentParameterBindings,
    ComponentParameterTypes
} from "../localex/local-execution-types";
import { Execution } from "../mint/mint-types";

export type TapisComponent = {
    id: string;
    version: string;
    rundir: string;
    softwareImage?: string;
    inputs: ComponentArgument[];
    outputs: ComponentArgument[];
};

export interface TapisComponentSeed {
    component: TapisComponent;
    execution: Execution;
    datasets: ComponentDataBindings;
    parameters: ComponentParameterBindings;
    paramtypes: ComponentParameterTypes;
    tapisAppId?: string;
    tapisAppVersion?: string;
}
