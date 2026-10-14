// Ordered integration journey: each suite declares its dependencies on the shared fixture.
const context = require('./ui-checks/context.cjs');
Object.assign(context, require('./ui-checks/rendering.cjs')(context));
require('./ui-checks/interaction.cjs')(context);
require('./ui-checks/dispatch.cjs')(context);
require('./ui-checks/routing.cjs')(context);
require('./ui-checks/overlays.cjs')(context);
require('./ui-checks/responsive.cjs')(context);
require('./ui-checks/preferences.cjs')(context);
require('./ui-checks/expansion.cjs')(context);
