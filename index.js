/**
 * dsh-ctrl-enter-send — Host half.
 *
 * The feature is browser-only: the Client half (client.js) rewrites the
 * composer's Enter gesture inside the Web UI. This half exists only so the
 * bundle's patch row resolves to a real plugin; it registers nothing, injects
 * no service, and touches no configuration.
 */
export function apply() {}
