import customer_svelteConfig from "./customer_svelte.config.js";
import adapter from '@yarbsemaj/adapter-lambda'

if(!customer_svelteConfig.kit) customer_svelteConfig.kit = {}
customer_svelteConfig.kit.adapter = adapter()
if(!customer_svelteConfig.kit.csrf) customer_svelteConfig.kit.csrf = {}
customer_svelteConfig.kit.csrf.checkOrigin = false

export default customer_svelteConfig