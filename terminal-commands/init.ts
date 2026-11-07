import TerminalCommands, { readline } from "../../../terminal-commands/index.js";
import Module from "../index.js";

import * as Twitch from "twitch.ts";
import http from "http";

function getPortInURL(url: URL): number {
	if (url.port.length > 0)
		return parseInt(url.port);
	if (url.protocol === "https:" || url.protocol === "wss:")
		return 443;
	if (url.protocol === "ftp:")
		return 21;
	return 80; // if (url.protocol === "http:" || url.protocol === "ws:")
}

async function clientIDPart(rl: readline.Interface) {
	console.log(`Enter Twitch API client ID here\nYou can get it from https://dev.twitch.tv/console/apps\n`);

	if (Module.authorization.client_id)
		rl.write(Module.authorization.client_id);
	const client_id = await rl.question("client_id: ");

	Module.authorization.client_id = client_id;
	await Module.data.save();
	console.log(`Saved!`);
}

async function clientSecretPart(rl: readline.Interface) {
	console.log(`Enter Twitch API client secret here\nYou can get it from https://dev.twitch.tv/console/apps\n`);

	if (Module.authorization.client_secret)
		rl.write(Module.authorization.client_secret);
	const client_secret = await rl.question("client_secret: ");

	Module.authorization.client_secret = client_secret;
	await Module.data.save();
	console.log(`Saved!`);
}

async function authorizePart() {
	const time = Date.now();
	const redirectURLString = `${Module.redirect_url.protocol}//${Module.redirect_url.hostname}${Module.redirect_url.port.length > 0 ? `:${Module.redirect_url.port}` : ""}`;
	const code = await new Promise<string>(resolve => {
		console.log(`Creating HTTP server...`);
		const server = http.createServer((req, res) => {
			req.method ??= "GET";
			process.stdout.write(`${req.method} `);
			req.url ??= "/";
			process.stdout.write(`${req.url}`);
			if (req.method !== "GET") {
				res.statusCode = 405;
				process.stdout.write(` ${res.statusCode}\n`);
				return res.end();
			}

			const url = new URL(req.url, Module.redirect_url);
			if (url.pathname !== "/") {
				res.statusCode = 404;
				process.stdout.write(` ${res.statusCode}\n`);
				return res.end();
			}

			const response = Twitch.OAuth2.GetAuthorizationCode.parseRedirectURL(url);
			if (response.error != null) {
				res.statusCode = 500;
				process.stdout.write(` ${res.statusCode}\n`);
				res.write(`${response.error}\n${response.error_description}`);
				console.log(`500 Internal Server Error: ${response.error} - ${response.error_description}`);
				return res.end();
			}

			res.statusCode = 202;
			process.stdout.write(` ${res.statusCode}\n\n`);
			res.write("You can close this window now");
			res.end();
			server.closeAllConnections();
			server.closeIdleConnections();
			server.close();
			resolve(response.code);
		});
		server.listen(getPortInURL(Module.redirect_url), Module.redirect_url.hostname, () => {
			console.log(`HTTP server started (${Date.now() - time}ms)\n`);
			console.log(`Also you need to set OAuth Redirect URL in your twitch app to ${redirectURLString}\nClick the link and authorize the app:\n${Twitch.OAuth2.GetAuthorizationCode.makeURL({
				client_id: Module.authorization.client_id,
				redirect_uri: redirectURLString,
				scope: Module.scopes,
			})}\n`);
		});
	});

	console.log("Getting refresh token...");
	const result = await Twitch.OAuth2.GetUserAccessTokenWithAuthorizationCode.axiosRequest({
		client_id: Module.authorization.client_id,
		client_secret: Module.authorization.client_secret,
		redirect_uri: redirectURLString,
		code
	});
	if (!result.ok) {
		console.error(`${result.status} - ${result.message}`);
		process.exit(1);
	}

	Module.authorization.refresh_token = result.refresh_token;
	Module.data.disabled = false;
	await Module.data.save();
	console.log(`Saved!`);
}

export const twitchInitName = "twitch:init";

export default () => {
	TerminalCommands.registerWithReadlineInterface(twitchInitName, async(argv, rl) => {
		if (argv.length > 0) {
			if (argv.includes("client_id")) {
				await clientIDPart(rl);
				console.log("");
			}
		} else {
			if (Module.authorization.client_id.length < 1)
				await clientIDPart(rl);
			else {
				if ((await rl.question("Edit Twitch API client ID? (y/n): ")).toLowerCase() === "y")
					await clientIDPart(rl);
			}
			console.log("");
		}

		if (argv.length > 0) {
			if (argv.includes("client_secret")) {
				await clientSecretPart(rl);
				console.log("");
			}
		} else {
			if (Module.authorization.client_secret.length < 1)
				await clientSecretPart(rl);
			else {
				if ((await rl.question("Edit Twitch API client secret? (y/n): ")).toLowerCase() === "y")
					await clientSecretPart(rl);
			}
			console.log("");
		}

		await authorizePart();

		return true;
	});
};