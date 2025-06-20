export interface GenericResponse {
    result: string;
    message: string;
}

export const createResponse = (result: string, message: string): GenericResponse => {
    return {
        result: result,
        message: message
    };
};
