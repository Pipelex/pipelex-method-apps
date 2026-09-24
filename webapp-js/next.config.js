/** @type {import('next').NextConfig} */
const nextConfig = {
  // No `serverActions.bodySizeLimit`: the 1 MB default fits every request this
  // app makes. A dropped file goes from the browser straight to Pipelex storage
  // with an upload grant (src/hooks/useFileInputs.ts), so a Server Action only
  // ever receives a file's name, type and size, and a run only references. The
  // limit used to be raised for files sent inline as base64, which is what a
  // list of photos outgrew; keeping the default refuses such a body outright.
  // The floating badge `next dev` draws on every page. The app is what its
  // developer shows people, and the badge is chrome of Next's, not of the app.
  // Next still surfaces compile and runtime errors with it off.
  devIndicators: false,
  // `next dev` logs every Server Function call with its arguments, which are
  // whatever a user typed into the form — a contract's text, a candidate's
  // details — and, before files went straight to storage, every document a user
  // dropped, printed whole as base64. Only the object form turns that one log
  // off: `logging: false` would silence the fetch logs too.
  logging: {
    serverFunctions: false,
  },
  async headers() {
    return [
      {
        // Every path EXCEPT the assets route, which sets its own headers in
        // `src/lib/assetHeaders.ts`. Two rules would collide there: a global
        // `X-Frame-Options: DENY` blocks framing even same-origin, so a PDF
        // result would no longer render in the kernel's document preview now
        // that the preview's src is a path on this origin, and the global
        // `Referrer-Policy` would contend with the stricter one the asset
        // response asks for.
        source: "/((?!api/assets/).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
