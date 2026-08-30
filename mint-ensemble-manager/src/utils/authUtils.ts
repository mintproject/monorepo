import jwt, { Algorithm } from "jsonwebtoken";
import { getConfiguration } from "@/classes/mint/mint-functions";
import { UnauthorizedError } from "@/classes/common/errors";
export const getTokenFromRequest = (req: any) => {
    const authHeader = req.headers.authorization;
    return getTokenFromAuthorizationHeader(authHeader);
};

export const getTokenFromAuthorizationHeader = (authorizationHeader: string) => {
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
        throw new UnauthorizedError("Invalid authorization header");
    }
    return authorizationHeader.split(" ")[1];
};

export const verifyToken = (token: string): boolean => {
    const prefs = getConfiguration();
    const PUBLIC_KEY = prefs.auth.public_key.replace(/\\n/g, "\n");
    const algorithms: Algorithm[] = prefs.auth.algorithms as Algorithm[];

    if (!PUBLIC_KEY) {
        console.error("Public key not found in environment variables");
        return false;
    }

    try {
        // Verify the token using configured algorithms
        const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms });
        return true;
    } catch (error) {
        return false;
    }
};

export const securityHandlers = {
    BearerAuth: async (req, scopes) => {
        // Get the token from the Authorization header
        const token = getTokenFromRequest(req);
        if (!token) {
            return false;
        }
        try {
            return verifyToken(token);
        } catch (error) {
            console.error("Token validation error:", error);
            return false;
        }
    },
    oauth2: async (req, scopes) => {
        // Get the token from the Authorization header
        const token = getTokenFromRequest(req);
        if (!token) {
            return false;
        }
        try {
            return verifyToken(token);
        } catch (error) {
            console.error("Token validation error:", error);
            return false;
        }
    }
};
