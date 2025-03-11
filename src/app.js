const express = require("express");
const path = require("path");
const { exec } = require("child_process");

const app = express();
const port = 3000;

// Function to convert permission string to an integer
const permissionsToInteger = (permissionString) => {
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
  return result;
};

// Function to analyze each entry from the ls output
const analyzeEntry = (entryLine, pathString) => {
  const permissionString = entryLine[0];

  const type =
    permissionString[0] === "l"
      ? "link"
      : permissionString[0] === "d"
      ? "dir"
      : "file";

  const permission = permissionsToInteger(permissionString) + "";
  const name = entryLine.slice(8).join(" ");
  const path = pathString.endsWith("/") ? pathString + name : pathString + "/" + name; // Ensure single slash

  // Format symbolic link names for better readability
  const formattedName = type === "link" ? name.replace(/ -\u003E /g, " -> ") : name;

  return {
    name: formattedName,
    path,
    type,
    permission,
  };
};

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

// Endpoint to list directory contents
app.get("/ls", (req, res) => {
  // Ensure requestedPath is defined correctly
  const requestedPath = (req.query.path === "/" || req.query.path === "") ? "/" : (req.query.path || "/");

  exec(`ls -lh ${requestedPath}`, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: `Error: ${error.message}` });
    }
    if (stderr) {
      return res.status(500).json({ error: `stderr: ${stderr}` });
    }

    const entries = stdout
      .split("\n")
      .filter((line) => line)
      .slice(1) // Skip the first entry
      .map((line) => {
        const parts = line.split(/\s+/);
        return analyzeEntry(parts, requestedPath); // Pass the requestedPath directly
      });

    res.json(entries); // Send the structured entries as JSON
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
