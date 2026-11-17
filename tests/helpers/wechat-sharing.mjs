/** Callback SDK fixture shared by scene and native-sharing checks. */
export function sharingFixture() {
  const friends = new Set();
  const timeline = new Set();
  const menus = [];
  return {
    friends,
    timeline,
    menus,
    api: {
      showShareMenu: (options) => menus.push(...options.menus),
      onShareAppMessage: (handler) => friends.add(handler),
      offShareAppMessage: (handler) => friends.delete(handler),
      onShareTimeline: (handler) => timeline.add(handler),
      offShareTimeline: (handler) => timeline.delete(handler),
    },
  };
}
