import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as cn } from "./store-B04VE7wS.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/badge-Xpy20-29.js
var import_jsx_runtime = require_jsx_runtime();
var badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", {
	variants: { variant: {
		default: "bg-elevated text-foreground",
		muted: "bg-elevated text-muted-foreground",
		accent: "bg-accent/15 text-accent",
		success: "bg-success/15 text-success",
		warning: "bg-warning/15 text-warning"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
//#endregion
export { Badge as t };
