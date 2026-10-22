import express from 'express';
import { getTrackInfo, searchMusic } from './services/innertube.js';
import { proxyAudio } from "./services/stream-proxy.js";

const app = express();
const port = 3000;

app.get("/", (req, res) => {
    res.json({ message: "Hello World" });
});

app.get("/search", async (req, res) => {
    const query = req.query.q as string;

    if(!query){
        res.status(400).json({ error: "Query is required" });
        return;
    }

    try{
        const tracks = await searchMusic(query);

        res.json({
            query, 
            tracks 
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to search music" });
        console.error("Error searching music:", error);
    }
});

app.get("/info/:id", async (req, res) => {
    const id = req.params.id.trim();
  
    if (!id) {
      res.status(400).json({ error: "Video ID is required" });
      return;
    }
  
    try {
      const track = await getTrackInfo(id);
      res.json(track);
    } catch (error) {
      console.error("Error getting track info:", error);
      res.status(502).json({ error: "Failed to get track info" });
    }
  });

  app.get("/stream/:id", async (req, res) => {
    const id = req.params.id.trim();
  
    if (!id) {
      res.status(400).json({ error: "Video ID is required" });
      return;
    }
  
    try {
      await proxyAudio(req, res, id);
    } catch (error) {
      console.error("Error proxying audio:", error);
  
      if (!res.headersSent) {
        res.status(502).json({
          error: "Failed to proxy audio",
        });
      }
    }
  });
  
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
