#!/usr/bin/env node
/**
 * Generates the dated org fixtures for e2e tests.
 *
 * Why: the e2e assertions (e2e/agenda.test.ts etc.) expect items on
 * yesterday/today/tomorrow. Checked-in fixtures with literal dates went stale
 * and had to be hand-edited forward. Instead, the checked-in files are
 * templates (e2e/test-data/*.org.tmpl) with date placeholders, and the .org
 * files are generated (and gitignored) with dates relative to the current day.
 *
 * Placeholder syntax (inside a template):
 *   {{d:OFFSET}}        -> "2026-07-23 Thu"        (OFFSET days from today)
 *   {{d:OFFSET HH:MM}}  -> "2026-07-23 Thu 10:00"
 * OFFSET is a signed integer number of days ("+1", "0", "-1", ...). The
 * placeholder expands to the timestamp body only; the surrounding <...>
 * (active) or [...] (inactive) brackets stay literal in the template.
 *
 * Date math lives in e2e/test-dates.js, which the e2e tests also use, so the
 * fixtures and test expectations can never disagree.
 *
 * Usage:
 *   node e2e/generate-test-data.js [outputDir]
 *
 * With no argument, writes the .org files next to the templates in
 * e2e/test-data/. Invoked by e2e/local-api.sh, the e2e GitHub workflow, and
 * resetTestData() in e2e/helpers/test-helpers.ts.
 */
/* global __dirname */
"use strict";

const fs = require("fs");
const path = require("path");
const { orgDate } = require("./test-dates");

const TEMPLATE_DIR = path.join(__dirname, "test-data");
const PLACEHOLDER = /\{\{d:([+-]?\d+)(?: (\d{2}:\d{2}))?\}\}/g;

function render(templatePath, outputPath) {
  const template = fs.readFileSync(templatePath, "utf-8");
  const rendered = template.replace(PLACEHOLDER, (_match, offset, time) =>
    orgDate(parseInt(offset, 10), time),
  );

  const leftover = rendered.match(/\{\{[^}]*\}\}/);
  if (leftover) {
    throw new Error(
      `${templatePath}: unrecognized placeholder ${leftover[0]} ` +
        "(expected {{d:OFFSET}} or {{d:OFFSET HH:MM}})",
    );
  }

  fs.writeFileSync(outputPath, rendered);
  console.log(`[generate-test-data] wrote ${outputPath}`);
}

function main() {
  const outputDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : TEMPLATE_DIR;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const templates = fs
    .readdirSync(TEMPLATE_DIR)
    .filter((name) => name.endsWith(".org.tmpl"));

  if (templates.length === 0) {
    throw new Error(`No *.org.tmpl templates found in ${TEMPLATE_DIR}`);
  }

  for (const name of templates) {
    render(
      path.join(TEMPLATE_DIR, name),
      path.join(outputDir, name.replace(/\.tmpl$/, "")),
    );
  }
}

main();
