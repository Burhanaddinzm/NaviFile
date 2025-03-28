const express = require("express");
const path = require("path");
const { exec, spawn } = require("child_process");

const app = express();
const port = 49154;

const convertToDateTime = (str) => {
  const parts = str.split(" ");

  const currentYear = new Date().getFullYear();
  let day, month, year, time;

  if (parts[parts.length - 1].includes(":")) {
    day = parts[0];
    month = parts[1];
    time = parts[2];
    year = currentYear;
  } else {
    day = parts[0];
    month = parts[1];
    year = parts[2];
    time = "00:00"; // Default time
  }

  const dateString = `${day} ${month} ${year} ${time}`;
  const dateJsFormat = new Date(dateString);
  return { dateString, dateJsFormat };
};

const permissionsToIntStr = (permissionString) => {
  let result = 0;

  const permissionValues = {
    r: 4, // Read
    w: 2, // Write
    x: 1, // Execute
  };

  for (let i = 1; i < permissionString.length; i += 3) {
    let chunk = permissionString.slice(i, i + 3);
    let chunkValue = 0;

    for (let j = 0; j < chunk.length; j++) {
      if (chunk[j] in permissionValues) {
        chunkValue += permissionValues[chunk[j]];
      }
    }
    result = result * 10 + chunkValue;
  }
  return result.toString();
};

const checkIfDir = (linkTarget) => {
  return new Promise((resolve) => {
    exec(`stat -c %F "${linkTarget}"`, (error, stdout) => {
      if (error) {
        return resolve(false); // Assume it's not a directory if stat fails
      }
      resolve(stdout.trim() === "directory");
    });
  });
};

const analyzeEntry = async (entryLine, pathString) => {
  const permissionString = entryLine[0];
  let type =
    permissionString[0] === "l"
      ? "link"
      : permissionString[0] === "d"
      ? "dir"
      : "file";

  const { dateString } = convertToDateTime(
    `${entryLine[6]} ${entryLine[5]} ${entryLine[7]}`
  );

  const size = entryLine[4];
  const permission = permissionsToIntStr(permissionString);
  let name = entryLine.slice(8).join(" ");

  let linkPath = null;
  if (type === "link") {
    const parts = name.split(" -\u003E ");
    if (parts.length > 1) {
      // name = parts[0];
      let potentialLinkPath = parts[1];

      // Resolve relative paths
      if (!potentialLinkPath.startsWith("/")) {
        potentialLinkPath = path.join(pathString, potentialLinkPath);
      }

      linkPath = potentialLinkPath;
      if (await checkIfDir(potentialLinkPath)) {
        type = "link-dir";
      } else {
        type = "link-file";
      }
    }
  }

  const fullPath =
    type === "link-file" || type === "link-dir"
      ? `${pathString.endsWith("/") ? pathString : pathString + "/"}${
          name.split(" -\u003E ")[0]
        }`
      : `${
          pathString.endsWith("/") ? pathString + name : pathString + "/" + name
        }`;

  return {
    name,
    fullPath,
    path: pathString,
    type,
    permission,
    size,
    date: dateString,
    linkPath,
  };
};

const splitEntries = async (stdout, requestedPath) => {
  const lines = stdout
    .split("\n")
    .filter((line) => line)
    .slice(1); // Skip first line

  const entries = await Promise.all(
    lines.map(async (line) => {
      const parts = line.match(
        /^(\S+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/
      );
      if (!parts) return null;

      const entryData = [
        parts[1], // Permissions
        parts[2], // Links
        parts[3], // Owner
        parts[4], // Group
        parts[5], // Size
        parts[6], // Month
        parts[7], // Day
        parts[8], // Time/Year
        parts[9], // File name (preserves spaces)
      ];

      return analyzeEntry(entryData, requestedPath);
    })
  );

  return entries.filter(Boolean); // purge false values (null,undefined,etc)
};

const run_ls = (requestedPath) => {
  return new Promise((resolve, reject) => {
    exec(`ls -lh "${requestedPath}"`, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(error.message));
      }
      if (stderr) {
        return reject(new Error(stderr));
      }
      const entries = splitEntries(stdout, requestedPath);
      resolve(entries);
    });
  });
};

const run_cat = (requestPath) => {
  return new Promise((resolve, reject) => {
    const cat = spawn("cat", [requestPath]);
    let data = "";

    cat.stdout.on("data", (chunk) => {
      data += chunk.toString();
    });

    cat.stderr.on("data", (error) => {
      reject(new Error(error.toString()));
    });

    cat.on("close", (code) => {
      if (code === 0) {
        resolve(data);
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
};

app.use(express.json({ limit: "100mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/ls", async (req, res) => {
  // making sure there is a default request path set, if not get root dir
  const requestedPath =
    req.query.path === "/" || req.query.path === ""
      ? "/"
      : req.query.path || "/";

  try {
    const result = await run_ls(requestedPath);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: `Error: ${error.message}` });
  }
});

app.get("/cat", async (req, res) => {
  if (req.query.path === "") return;
  const requestedPath = req.query.path;

  try {
    const result = await run_cat(requestedPath);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: `Error: ${error.message}` });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
