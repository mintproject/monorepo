import jwt, { Algorithm } from "jsonwebtoken";

export const verifyToken = (token: string): boolean => {
    // Use the RSA public key from the environment variable
    // The key should be in PEM format as shown in the tenant response
    const PUBLIC_KEY = process.env.PUBLIC_KEY.replace(/\\n/g, "\n");
    // Get algorithms from env or default to RS256
    const algorithms: Algorithm[] = process.env.JWT_ALGORITHMS
        ? process.env.JWT_ALGORITHMS.split(",").map((alg) => alg.trim() as Algorithm)
        : ["RS256"];

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
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return false;
        }

        const token = authHeader.split(" ")[1];

        try {
            return verifyToken(token);
        } catch (error) {
            console.error("Token validation error:", error);
            return false;
        }
    },
    oauth2: async (req, scopes) => {
        // Get the token from the Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return false;
        }

        const token = authHeader.split(" ")[1];

        try {
            return verifyToken(token);
        } catch (error) {
            console.error("Token validation error:", error);
            return false;
        }
    }
};
