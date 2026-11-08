import { TwitchModule as Module } from "./index.js";
import { BaseData } from "../../data.js";
import { twitchInitName } from "./terminal-commands/init.js";

export default class ModuleData extends BaseData {
	/** Module will disable itself on next app start, when fatal error will occure */
	disabled: boolean = false;

	protected module: Module;

	initialize() {
		const json = this.getSavedFields();
		let needsSave = true;

		needsSave = !this.registerFieldMap(json, "authorization",
			savedValue => this.module.authorization.fromJSON(savedValue),
			() => this.module.authorization.toJSON(),
		);
		needsSave = !this.registerFieldBoolean(json, "disabled");

		if (needsSave)
			this.save();
		return this;
	}

	async checkRequiredFields() {
		if (this.module.authorization.refresh_token.length < 1)
			await this.module.fatalWithDisabling(`Saved data is malformed, please initialize module with "node index.js ${twitchInitName}"`, {error: `authorization.refresh is expected as non-empty string`});
		if (this.module.authorization.client_id.length < 1)
			await this.module.fatalWithDisabling(`Saved data is malformed, please initialize module with "node index.js ${twitchInitName}"`, {error: `authorization.id is expected as non-empty string`});
		if (this.module.authorization.client_secret.length < 1)
			await this.module.fatalWithDisabling(`Saved data is malformed, please initialize module with "node index.js ${twitchInitName}"`, {error: `authorization.secret is expected as non-empty string`});
	}
}