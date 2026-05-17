# Taskloom in one step

You don't need to know Node, npm, or anything technical. Just one command.

## Start it

**macOS or Linux:**

```
./scripts/run.sh
```

**Windows (PowerShell):**

```
./scripts/run.ps1
```

That's it. Your browser will open to the Taskloom builder a few seconds later.

## First time?

1. Copy `.env.example` to `.env` in this folder.
2. Open `.env` in any text editor and add one API key (the file tells you where to get one).
3. Run the command above.

If you forget step 2, the launcher will stop and tell you exactly what to do.

## What just happened?

The launcher script does five things so you don't have to:

1. Installs dependencies the first time (about a minute, then never again).
2. Reads your `.env` so the app knows which AI to talk to.
3. Runs a quick check to make sure Node is new enough and you have an AI key.
4. Opens `http://localhost:7341/builder` in your browser.
5. Starts the local server.

When you're done, press `Ctrl+C` in the terminal to stop it.

## FAQ

**Why do I need a key?** Taskloom asks an AI to write your app; the key lets it talk to that AI. You bring your own; nothing goes to Taskloom. The key stays on your computer in the `.env` file.

**Which provider should I pick?** Anthropic (Claude) is the smoothest. OpenAI works too. If you want everything free and local, install [Ollama](https://ollama.com) and use that — no key needed.

**Something went wrong.** Read the message in the terminal — it usually tells you exactly what to do. If you're stuck, the project README has the long version.
