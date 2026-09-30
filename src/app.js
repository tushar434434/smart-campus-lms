import Fastify from "fastify";
export function buildApp() {
    const app = Fastify({
        logger: true,
    });
    app.get("/health", async () => {
        return {
            status: "ok",
            service: "smart-campus-lms",
        };
    });
    return app;
}
//# sourceMappingURL=app.js.map