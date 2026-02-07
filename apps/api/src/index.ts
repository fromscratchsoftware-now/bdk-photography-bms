import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`BDK API listening on http://localhost:${env.port}`);
});

