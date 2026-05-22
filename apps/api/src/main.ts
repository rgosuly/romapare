import Fastify from "fastify";
import { APP_NAME } from "@romapare/shared";

const app = Fastify({ logger: true });

app.get("/api/health", async () => {
  return { status: "ok", app: APP_NAME };
});

const start = async () => {
  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
