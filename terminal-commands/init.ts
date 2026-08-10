import TerminalCommands, { ReadlineInterfaceAdvanced } from "../../../terminal-commands/index.js";
import Module from "../index.js";

import * as Twitch from "twitch.ts";
import http from "http";

async function clientIDPart(rl: ReadlineInterfaceAdvanced) {
	rl
	console.log(`Enter Twitch API client ID here\nYou can get it from https://dev.twitch.tv/console/apps\n`);

	if (Module.data.clientID)
		rl.write(Module.data.clientID);
	const clientID = await TerminalCommands.question(rl, "clientID: ");

	Module.data.clientID = clientID;
	Module.data.save();
	console.log(`Saved!`);
}

async function clientSecretPart(rl: ReadlineInterfaceAdvanced) {
	console.log(`Enter Twitch API client secret here\nYou can get it from https://dev.twitch.tv/console/apps\n`);

	if (Module.data.clientSecret)
		rl.write(Module.data.clientSecret);
	const clientSecret = await TerminalCommands.question(rl, "clientSecret: ");

	Module.data.clientSecret = clientSecret;
	Module.data.save();
	console.log(`Saved!`);
}

async function authorizePart(rl: ReadlineInterfaceAdvanced) {
	const time = Date.now();
	const code = await new Promise<string>(resolve => {
		console.log(`Creating HTTP server...`);
		const server = http.createServer((req, res) => {
			res.setHeader("Content-Type", "text/plain;charset=utf-8");
			console.log(`${req.method ?? "IDK"} ${req.url ?? "/"}`);
			if (req.method === "GET") {
				let url = req.url ?? "/";
				if (url.startsWith("/?")) {
					url = url.substring(2);
					for (const v of url.split("&")) if (v.startsWith("code=")) {
						res.statusCode = 202;
						res.write("You can close this window now");
						res.end();
						server.closeAllConnections();
						server.closeIdleConnections();
						server.close();
						resolve(v.substring(5));
						return;
					}
				}

				res.statusCode = 400;
				res.write("URL search parameters do not have the field code");
				res.end();
			}
			else {
				res.statusCode = 405;
				res.write(`${req.method} is not supported`);
				res.end();
			}
		});
		server.on("close", () => {
			console.log("HTTP server was closed");
		});
		server.listen(Module.redirectPort, () => {
			console.log(`HTTP server started (${Date.now() - time}ms)\n`);
			console.log(`Also you need to set OAuth Redirect URL in your twitch app to ${Module.redirectURL}\nClick the link and authorize the app:\n${Twitch.Authorization.URL.Code(Module.data.clientID, Module.redirectURL, Module.scopes)}\n`);
		});
	});

	console.log("Getting tokens...");
	const response = await Twitch.Request.OAuth2Token.AuthorizationCode(Module.data.clientID, Module.data.clientSecret, Module.redirectURL, code);
	if (response.ok) {
		const responseValidate = await Twitch.Request.OAuth2Validate(response.access_token);
		if (responseValidate.ok) {
			if (responseValidate.type === "app") {
				console.error("Access token is not user access token");
				return process.exit(1);
			}

			Module.data.accessToken = response.access_token;
			Module.data.refreshToken = response.refresh_token;
			Module.data.save();
			console.log(`Tokens were saved!\n\nApp will be authenticated in Twitch as ${responseValidate.user_login} (${responseValidate.user_id})`);
			process.exit();
		}
		else {
			console.error(`Validating gotten access token failed!\n\tcode: ${responseValidate.status} - ${responseValidate.message}`);
			process.exit(1);
		}
	}
	else {
		console.error(`Getting tokens from authorization code failed!\n\tcode: ${response.status} - ${response.message}`);
		process.exit(1);
	}
}

export default () => {
	TerminalCommands.registerWithReadlineInterface("twitch:init", async(argv, rl) => {
		if (argv.length > 0) {
			if (argv.includes("clientID")) {
				await clientIDPart(rl);
				console.log("");
			}
		} else {
			if (Module.data.clientID.length < 1)
				await clientIDPart(rl);
			else {
				if ((await TerminalCommands.question(rl, "Edit Twitch API client ID? (y/n): ")).toLowerCase() === "y")
					await clientIDPart(rl);
			}
			console.log("");
		}

		if (argv.length > 0) {
			if (argv.includes("clientSecret")) {
				await clientSecretPart(rl);
				console.log("");
			}
		} else {
			if (Module.data.clientSecret.length < 1)
				await clientSecretPart(rl);
			else {
				if ((await rl.questionAsync("Edit Twitch API client secret? (y/n): ")).toLowerCase() === "y")
					await clientSecretPart(rl);
			}
			console.log("");
		}

		await authorizePart(rl);

		return true;
	});
};