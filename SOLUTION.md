# Romapare — Solution Overview

## Concept

A 3D point cloud map of Romania styled by altitude, inspired by Komoot but focused on Romanian terrain.
Each point is colored based on elevation — no mesh, no faces, no triangulation — just points in 3D space.

---

## Data Sources

- **Terrain / Elevation** — Copernicus DEM GLO-10 (10m resolution, free, ~70–80M points for Romania)
- **Trails / POIs / Roads** — OpenStreetMap via Geofabrik dumps or Overpass API
- **LIDAR** — not reliably available for Romania; Copernicus DEM is the practical choice

---

## Frontend

- **deck.gl PointCloudLayer** — renders the point cloud, handles 70–80M points comfortably
- **MapLibre GL JS** — base map context underneath deck.gl (borders, labels, trails)
- **Color gradient** — altitude-based coloring applied per point, no shading between points

---

## Backend

- **Node.js** — API layer, authentication, file uploads, orchestration
- **PostgreSQL + PostGIS** — stores terrain points, trails, and POIs; handles spatial queries
- **pgRouting** — trail routing if needed later
- Node queries PostGIS for points within the current viewport and returns them to the frontend
- PostGIS spatial indexes handle real-time map interaction efficiently

---

## Infrastructure Cost

- Near zero at early stage
- Copernicus DEM and OSM data are free
- No tile serving infrastructure needed

---

## Open Questions

1. Color palette for the altitude gradient
2. How trails are rendered on top of the point cloud
3. Dynamic loading strategy — viewport-based point fetching for performance at different zoom levels
