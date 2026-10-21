import App from "./App.tui.ts";
import { createApp } from "@denotui/deno-tui";

const app = createApp(App, {}, {
  onKey(event) {
    if (
      event.name === "q" || event.name === "escape" ||
      (event.ctrl && event.name === "c")
    ) {
      app.stop();
    }
  },
});

app.start();
