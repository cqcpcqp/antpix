/** Public routing API. Geometry, search scratch space and sampling stay independent. */
export { findAntRoute } from './pathSearch';
export { clearSegment, smoothRoute } from './routeGeometry';
export { prepareRoute, routeLength, samplePreparedRoute, sampleRoute } from './routeSampling';
export { AntRouteSearch } from './routeSearch';
export type {
    AntAssignment,
    AntTarget,
    BoardGrid,
    PreparedRoute,
    RoutePoint,
    RoutePose,
} from './routeTypes';
export { AntTargetSearch, nearestAntTarget } from './targetSearch';
