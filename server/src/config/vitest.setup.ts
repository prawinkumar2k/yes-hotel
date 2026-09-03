import { installUnscopedWriteGuard } from "./mongoose-safety";

// The original incident this guard exists for happened in a TEST cleanup
// step, not production runtime code — so the guard must be active here too,
// not only inside createServer(), which test files never call.
installUnscopedWriteGuard();
