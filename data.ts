import Core from "../../index.js";
import { BaseData } from "../../data.js";

import { Options } from "twitch.ts";

export default class ModuleData extends BaseData {
	clientID: string = "";
	clientSecret: string = "";
	accessToken: string = "";
	refreshToken: string = "";
	subscriptionsID: string[] = [];

	initialize() {
		const json = super.getSavedFields();
		let needsSave = true;

		needsSave = !this.registerFieldString(json, "clientID");
		needsSave = !this.registerFieldString(json, "clientSecret");
		needsSave = !this.registerFieldString(json, "accessToken");
		needsSave = !this.registerFieldString(json, "refreshToken");
		needsSave = !this.registerFieldArray(json, "subscriptionsID");

		if (needsSave)
			this.save();
		return this;
	}

	checkRequiredFields() {
		if (this.clientID.length < 1)
			Core.log.fatal(`Config parameter "clientID" is empty, please initialize app with "node index.js twitch:init"`);
		if (this.clientSecret.length < 1)
			Core.log.fatal(`Config parameter "clientSecret" is empty, please initialize app with "node index.js twitch:init"`);
		if (this.refreshToken.length < 1 && !Options.twitchCLIMode)
			Core.log.fatal(`Config parameter "refreshToken" is empty, please initialize app with "node index.js twitch:init"`);
	}
}