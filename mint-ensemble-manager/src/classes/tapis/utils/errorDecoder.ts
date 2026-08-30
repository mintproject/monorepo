import {
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    NotFoundError,
    UnauthorizedError
} from "@/classes/common/errors";

const errorDecoder = async <T>(func: () => Promise<T>) => {
    try {
        // Call the specified function name, and expect that specific return type
        const result: T = await func();
        return result;
    } catch (error) {
        // If an exception occurred, try to decode the json response from it and
        // rethrow it
        if ((error as any).json) {
            const decoded = await (error as any).json();
            if (error.status == 404) {
                throw new NotFoundError(decoded.message);
            } else if (error.status == 401) {
                throw new UnauthorizedError(decoded.message);
            } else if (error.status == 403) {
                throw new ForbiddenError(decoded.message);
            } else if (error.status == 400) {
                throw new BadRequestError(decoded.message);
            } else if (error.status == 500) {
                throw new InternalServerError(decoded.message);
            } else {
                throw new Error(decoded.message);
            }
        } else {
            throw error;
        }
    }
};

export default errorDecoder;
