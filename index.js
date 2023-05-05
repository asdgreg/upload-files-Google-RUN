const express = require('express');
const {readFileSync} = require('fs');
const handlebars = require('handlebars');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const cors = require('cors');
const app = express();
app.use(cors());
const storage = new Storage();

const bucket = storage.bucket('develop-qqb92');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});


// Serve the files in /assets at the URI /assets.
app.use('/assets', express.static('assets'));

// The HTML content is produced by rendering a handlebars template.
// The template values are stored in global state for reuse.
const data = {
  service: process.env.K_SERVICE || '???',
  revision: process.env.K_REVISION || '???',
};
let template;

app.get('/', async (req, res) => {
  // The handlebars template is stored in global state so this will only once.
  if (!template) {
    // Load Handlebars template from filesystem and compile for use.
    try {
      template = handlebars.compile(readFileSync('index.html.hbs', 'utf8'));
    } catch (e) {
      console.error(e);
      res.status(500).send('Internal Server Error');
    }
  }

  // Apply the template to the parameters to generate an HTML string.
  try {
    const output = template(data);
    res.status(200).send(output);
  } catch (e) {
    console.error(e);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  const blob = bucket.file(file.originalname);
  const blobStream = blob.createWriteStream({
    resumable: false,
    metadata: {
      contentType: file.mimetype,
    },
  });

  blobStream.on('error', (err) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  blobStream.on('finish', () => {
    res.status(200).json({ message: 'File uploaded successfully' });
  });

  blobStream.on('progress', (event) => {
    const progress = (event.bytesWritten / file.size) * 100;
    console.log(`Upload progress: ${progress}%`);
  });

  blobStream.end(file.buffer);
});



const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(
    `Hello from Cloud Run! The container started successfully and is listening for HTTP requests on ${PORT}`
  );
});
