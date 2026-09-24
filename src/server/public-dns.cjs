const dns = require("node:dns");

const resolver = new dns.Resolver();
resolver.setServers(["1.1.1.1", "8.8.8.8"]);
const original = dns.lookup.bind(dns);

dns.lookup = function lookup(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  const all = Boolean(options && options.all);
  resolver.resolve4(hostname, (error, addresses) => {
    if (error || !addresses || addresses.length === 0) {
      original(hostname, options, callback);
      return;
    }
    if (all) {
      callback(
        null,
        addresses.map((address) => ({ address, family: 4 })),
      );
      return;
    }
    callback(null, addresses[0], 4);
  });
};
