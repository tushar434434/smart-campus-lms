import { buildApp } from "./app.js";
const app = buildApp();
const start = async () => {
    try {
        await app.listen({
            port: 3000,
            host: "0.0.0.0",
        });
        console.log("Server running on http://localhost:3000");
    }
    catch (error) {
        app.log.error(error);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=server.js.map