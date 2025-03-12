const express = require("express");
const path = require("path");
const { exec } = require("child_process");

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

// Function to convert permission string to an integer
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
    // Add the chunk value to the result
    result = result * 10 + chunkValue;
  }
  return result.toString();
};

const analyzeEntry = (entryLine, pathString) => {
  const permissionString = entryLine[0];

  const type =
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
  const name = entryLine.slice(8).join(" ");
  // normalizing path to make sure it appears correctly
  const fullPath =
    type === "link"
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
  };
};

const splitEntries = (stdout, requestedPath) => {
  return stdout
    .split("\n") // 1. Split the output by newlines
    .filter((line) => line) // 2. Remove any empty lines
    .slice(1) // 3. Remove the first line (index 0)
    .map((line) => {
      // 4. Process each remaining line
      const parts = line.split(/\s+/); // 5. Split the line by one or more spaces (whitespace)
      return analyzeEntry(parts, requestedPath);
    });
};

const run_ls = (requestedPath) => {
  return new Promise((resolve, reject) => {
    exec(`ls -lh ${requestedPath}`, (error, stdout, stderr) => {
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
