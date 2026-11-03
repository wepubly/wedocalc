// Local test runner only. Handle unavailable interface enumeration in this container.
const os = require('node:os');
const original = os.networkInterfaces;
os.networkInterfaces = () => {
 try { return original(); }
 catch (e) {
  if(e.code !== 'ERR_SYSTEM_ERROR' || !String(e.message).includes('uv_interface_addresses')) throw e;
  return {lo:[{address:'127.0.0.1',netmask:'255.0.0.0',family:'IPv4',mac:'00:00:00:00:00:00',internal:true,cidr:'127.0.0.1/8'}]};
 }
};
require('node:module').syncBuiltinESMExports();
