# 这里先用示例数据，换成你真实的线即可（经度,纬度）


def _fc(name: str, coordinates: list[list[float]]):
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": name},
                "geometry": {
                    "type": "LineString",
                    "coordinates": coordinates,
                },
            }
        ],
    }


TRAIL_SEGMENTS = [
    {
        "id": "existing",
        "name": "Existing Lakeside Trail",
        "legendLabel": "Existing Trail",
        "status": "open",
        "description": "Fully constructed sections that are open to the public year-round.",
        "style": {"color": "#0f766e", "weight": 5},
        "isPublic": True,
        "order": 1,
        "geojson": _fc(
            "Existing Lakeside Trail",
            [
                [172.14, -43.68],
                [172.18, -43.70],
                [172.22, -43.71],
                [172.26, -43.73],
                [172.29, -43.74],
                [172.33, -43.75],
                [172.37, -43.76],
            ],
        ),
    },
    {
        "id": "stage-1",
        "name": "Stage 1 – Lakeside Boardwalk",
        "legendLabel": "Stage 1",
        "status": "construction",
        "description": "Currently under construction with new boardwalks and upgraded surfacing.",
        "style": {"color": "#2563eb", "weight": 5},
        "isPublic": True,
        "order": 2,
        "geojson": _fc(
            "Stage 1 – Lakeside Boardwalk",
            [
                [172.37, -43.76],
                [172.41, -43.78],
                [172.45, -43.79],
                [172.49, -43.81],
            ],
        ),
    },
    {
        "id": "stage-2",
        "name": "Stage 2 – Coastal Wetland",
        "legendLabel": "Stage 2",
        "status": "planned",
        "description": "Future section pending consents; alignment may change following consultation.",
        "style": {"color": "#2563eb", "weight": 5, "dashArray": "8 6"},
        "isPublic": True,
        "order": 3,
        "geojson": _fc(
            "Stage 2 – Coastal Wetland",
            [
                [172.49, -43.81],
                [172.53, -43.83],
                [172.57, -43.84],
                [172.61, -43.86],
            ],
        ),
    },
    {
        "id": "wetland-loop",
        "name": "Wetland Discovery Loop",
        "legendLabel": "Future Wetland Loop",
        "status": "planned",
        "description": "Concept-only loop through new wetland plantings. Hidden from public map until confirmed.",
        "style": {"color": "#7c3aed", "weight": 4, "dashArray": "4 6"},
        "isPublic": False,
        "order": 4,
        "geojson": _fc(
            "Wetland Discovery Loop",
            [
                [172.30, -43.74],
                [172.32, -43.73],
                [172.35, -43.72],
                [172.33, -43.71],
                [172.30, -43.72],
            ],
        ),
    },
]


def get_trails():
    return {
        "segments": [
            {
                "id": segment["id"],
                "name": segment["name"],
                "status": segment["status"],
                "description": segment["description"],
                "legendLabel": segment["legendLabel"],
                "style": segment["style"],
                "isPublic": segment["isPublic"],
                "geojson": segment["geojson"],
            }
            for segment in TRAIL_SEGMENTS
        ],
        "legend": [
            {
                "id": segment["id"],
                "label": segment["legendLabel"],
                "color": segment["style"]["color"],
                "dashArray": segment["style"].get("dashArray"),
            }
            for segment in sorted(TRAIL_SEGMENTS, key=lambda seg: seg["order"])
            if segment["isPublic"]
        ],
    }
