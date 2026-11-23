import Module from "./index.js";

import * as Twitch from "twitch.ts";

export interface AuthorizationSave {
	refresh: string;
	id: string;
	secret: string;
}

export default class Authorization {
	/** Will be not empty after validating */
	token = "";
	/** After changing this, do not forget to do `Module.data.save()` */
	refresh_token = "";
	/** After changing this, do not forget to do `Module.data.save()` */
	client_id = "";
	/** After changing this, do not forget to do `Module.data.save()` */
	client_secret = "";
	/** Will be not empty after validating */
	user_id = "";
	/** Will be not empty after validating */
	login = "";

	fromJSON(json: Partial<AuthorizationSave>) {
		if (json.refresh != null)
			this.refresh_token = json.refresh;
		if (json.id != null)
			this.client_id = json.id;
		if (json.secret != null)
			this.client_secret = json.secret;
		return this;
	}

	async refresh() {
		const result = await Twitch.OAuth2.RefreshUserAccessToken.axiosRequest({
			client_id: this.client_id,
			client_secret: this.client_secret,
			refresh_token: this.refresh_token,
		});
		if (!result.ok) {
			this.refresh_token = "";
			await Module.data.save();
			await Module.fatalWithDisabling(`Refreshing token was failed`, {error: `${result.status}: ${result.message}`})
			return;
		}

		this.token = result.access_token;
		this.refresh_token = result.refresh_token;
		await Module.data.save();
	}

	async validate() {
		const result = await Twitch.OAuth2.ValidateAccessToken.axiosRequest({
			token: this.token,
		});
		if (!result.ok) {
			await this.refresh();
			if (this.user_id.length === 0)
				await this.validate();
			return;
		}
		if (result.user_id == null) {
			this.refresh_token = "";
			await Module.data.save();
			return await Module.fatalWithDisabling(`Validating token was failed`, {error: `Gotten token is not user access token`});
		}
		if ((result.scopes ?? []).sort().join("") !== Module.scopes.sort().join("")) {
			this.refresh_token = "";
			await Module.data.save();
			return await Module.fatalWithDisabling(`Validating token was failed`, {error: `Gotten token has incorrect scopes`});
		}

		this.user_id = result.user_id;
		this.login = result.login;
	}

	async request<Parameters extends Twitch.RequestParameters = Twitch.RequestParameters, Response extends Twitch.Response<{}, Twitch.ResponseBodyError> = Twitch.Response<{}, Twitch.ResponseBodyError>>(func: (params: Parameters) => Promise<Response>, params: Omit<Parameters, "client_id" | "token">): Promise<Response> {
		const result = await func({
			client_id: this.client_id,
			token: this.token,
			...params,
		} as any);
		if (result.status === 401) {
			await this.refresh();
			return this.request(func, params);
		}
		if (result.status === 429) {
			let delay = 2500;
			const ratelimitResetString = result.headers["ratelimit-reset"];
			if (ratelimitResetString != null)
				delay += parseInt(ratelimitResetString) * 1000 - Date.now();
			await new Promise<void>(resolve => setTimeout(resolve, delay));
			return this.request(func, params);
		}
		return result;
	}

	toJSON(): AuthorizationSave {
		return {
			refresh: this.refresh_token,
			id: this.client_id,
			secret: this.client_secret,
		};
	}
}