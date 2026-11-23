// Windows NTFS Junction & Directory Copy compatibility shim for Vercel CLI local builds
// when Windows Developer Mode is not enabled.
const fs = require("fs");
const path = require("path");

const posixPath = __filename.replace(/\\/g, "/");
const reqFlag = `--require "${posixPath}"`;
if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes(posixPath)) {
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS
    ? `${process.env.NODE_OPTIONS} ${reqFlag}`
    : reqFlag;
}

if (process.platform === "win32") {
  const origPromiseSymlink = fs.promises.symlink.bind(fs.promises);
  const origSymlinkSync = fs.symlinkSync.bind(fs);
  const origSymlink = fs.symlink.bind(fs);

  function fallbackSync(target, linkPath) {
    const absTarget = path.resolve(
      path.dirname(String(linkPath)),
      String(target)
    );
    const linkStr = String(linkPath);
    // For .vercel/output/*.func bundles, copy the directory so the uploader reads real files
    if (linkStr.includes(".vercel") && linkStr.endsWith(".func")) {
      fs.cpSync(absTarget, linkStr, { recursive: true });
      return;
    }
    try {
      origSymlinkSync(absTarget, linkPath, "junction");
    } catch {
      fs.cpSync(absTarget, linkStr, { recursive: true });
    }
  }

  fs.promises.symlink = async function (target, linkPath, type) {
    try {
      return await origPromiseSymlink(target, linkPath, type);
    } catch (err) {
      if (err && err.code === "EPERM") {
        fallbackSync(target, linkPath);
        return;
      }
      throw err;
    }
  };

  fs.symlinkSync = function (target, linkPath, type) {
    try {
      return origSymlinkSync(target, linkPath, type);
    } catch (err) {
      if (err && err.code === "EPERM") {
        fallbackSync(target, linkPath);
        return;
      }
      throw err;
    }
  };

  fs.symlink = function (target, linkPath, typeOrCb, maybeCb) {
    const cb = typeof typeOrCb === "function" ? typeOrCb : maybeCb;
    const type = typeof typeOrCb === "function" ? undefined : typeOrCb;
    origSymlink(target, linkPath, type, (err) => {
      if (err && err.code === "EPERM") {
        try {
          fallbackSync(target, linkPath);
          cb(null);
        } catch (fallbackErr) {
          cb(fallbackErr);
        }
        return;
      }
      cb(err);
    });
  };
}
