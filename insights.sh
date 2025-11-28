#!/usr/bin/env bash
# Simple location insights helper using Google Geocoding + Places.
# Input: full street address.
# Output: "getting around" scores + nearby schools summary.
#
# Usage:
#   GEMINI_API_KEY="YOUR_KEY" ./house_location_insights.sh "12 Rue Exemple, Paris, France"
#
# Requirements: bash, curl, jq, awk.

set -euo pipefail

if [ -f ".env" ]; then
  set -a
  . ".env"
  set +a
fi

# ------------- CONFIG -------------

API_KEY="${GEMINI_API_KEY:-}"

WALK_RADIUS_M=1200    # for daily-life POI density (~15 min walk)
TRANSIT_RADIUS_M=800  # for transit stops
BIKE_RADIUS_M=1500    # for parks / bike POIs
SCHOOL_RADIUS_M=5000  # for nearby schools list

MAX_WALK_SCORE=100
MAX_TRANSIT_SCORE=100
MAX_BIKE_SCORE=100

# ------------- CHECKS -------------

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required." >&2
  exit 1
fi

if [ -z "$API_KEY" ]; then
  echo "Please set GEMINI_API_KEY environment variable." >&2
  exit 1
fi

if [ $# -lt 1 ]; then
  echo "Usage: $0 \"full street address\"" >&2
  exit 1
fi

ADDRESS="$*"

# ------------- HELPERS -------------

haversine_km() {
  # Usage: haversine_km lat1 lon1 lat2 lon2
  local lat1="$1" lon1="$2" lat2="$3" lon2="$4"
  awk -v lat1="$lat1" -v lon1="$lon1" -v lat2="$lat2" -v lon2="$lon2" '
  BEGIN {
    pi = atan2(0, -1)
    rad = pi / 180
    dlat = (lat2 - lat1) * rad
    dlon = (lon2 - lon1) * rad
    a = sin(dlat/2)^2 + cos(lat1*rad) * cos(lat2*rad) * sin(dlon/2)^2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    d = 6371 * c
    printf "%.2f", d
  }'
}

walk_label() {
  local s="$1"
  if   [ "$s" -lt 25 ]; then echo "Car-dependent"
  elif [ "$s" -lt 50 ]; then echo "Limited walkability"
  elif [ "$s" -lt 70 ]; then echo "Somewhat walkable"
  elif [ "$s" -lt 90 ]; then echo "Very walkable"
  else                        echo "Highly walkable"
  fi
}

transit_label() {
  local s="$1"
  if   [ "$s" -lt 25 ]; then echo "Minimal transit"
  elif [ "$s" -lt 50 ]; then echo "Some transit"
  elif [ "$s" -lt 70 ]; then echo "Good transit"
  elif [ "$s" -lt 90 ]; then echo "Very good transit"
  else                        echo "Excellent transit"
  fi
}

bike_label() {
  local s="$1"
  if   [ "$s" -lt 25 ]; then echo "Not very bike-friendly"
  elif [ "$s" -lt 50 ]; then echo "Somewhat bikeable"
  elif [ "$s" -lt 70 ]; then echo "Bikeable"
  elif [ "$s" -lt 90 ]; then echo "Very bikeable"
  else                        echo "Excellent for biking"
  fi
}

nearby_count() {
  # Usage: nearby_count TYPE RADIUS_METERS
  local type="$1"
  local radius="$2"
  curl -s "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${LAT},${LNG}&radius=${radius}&type=${type}&key=${API_KEY}" \
    | jq '.results | length'
}

# ------------- 1) GEOCODE ADDRESS -------------

echo "Geocoding address: $ADDRESS" >&2

ENCODED_ADDR=$(printf '%s' "$ADDRESS" | jq -sRr @uri)

GEOCODE_JSON=$(curl -s \
  "https://maps.googleapis.com/maps/api/geocode/json?address=${ENCODED_ADDR}&key=${API_KEY}")

GEOCODE_STATUS=$(echo "$GEOCODE_JSON" | jq -r '.status')

if [ "$GEOCODE_STATUS" != "OK" ]; then
  echo "Geocoding failed (status: $GEOCODE_STATUS)" >&2
  echo "$GEOCODE_JSON" | jq '.' >&2
  exit 1
fi

LAT=$(echo "$GEOCODE_JSON" | jq -r '.results[0].geometry.location.lat')
LNG=$(echo "$GEOCODE_JSON" | jq -r '.results[0].geometry.location.lng')
FORMATTED_ADDRESS=$(echo "$GEOCODE_JSON" | jq -r '.results[0].formatted_address')

echo " → Coordinates: $LAT, $LNG" >&2
echo

# ------------- 2) WALK / TRANSIT / BIKE "SCORES" -------------

# Walkability: daily-life POIs within WALK_RADIUS_M
WALK_TYPES=(
  "supermarket"
  "grocery_or_supermarket"
  "convenience_store"
  "shopping_mall"
  "pharmacy"
  "restaurant"
  "cafe"
)

walk_pois=0
for t in "${WALK_TYPES[@]}"; do
  c=$(nearby_count "$t" "$WALK_RADIUS_M")
  walk_pois=$((walk_pois + c))
done

walk_score=$(( walk_pois * 10 ))
if [ "$walk_score" -gt "$MAX_WALK_SCORE" ]; then
  walk_score=$MAX_WALK_SCORE
fi
walk_text=$(walk_label "$walk_score")

# Transit: transit-related POIs within TRANSIT_RADIUS_M
TRANSIT_TYPES=(
  "bus_station"
  "train_station"
  "subway_station"
  "transit_station"
)

transit_pois=0
for t in "${TRANSIT_TYPES[@]}"; do
  c=$(nearby_count "$t" "$TRANSIT_RADIUS_M")
  transit_pois=$((transit_pois + c))
done

transit_score=$(( transit_pois * 15 ))
if [ "$transit_score" -gt "$MAX_TRANSIT_SCORE" ]; then
  transit_score=$MAX_TRANSIT_SCORE
fi
transit_text=$(transit_label "$transit_score")

# Bike: parks + bicycle stores within BIKE_RADIUS_M
BIKE_TYPES=(
  "park"
  "bicycle_store"
)

bike_pois=0
for t in "${BIKE_TYPES[@]}"; do
  c=$(nearby_count "$t" "$BIKE_RADIUS_M")
  bike_pois=$((bike_pois + c))
done

bike_score=$(( bike_pois * 10 ))
if [ "$bike_score" -gt "$MAX_BIKE_SCORE" ]; then
  bike_score=$MAX_BIKE_SCORE
fi
bike_text=$(bike_label "$bike_score")

# ------------- 3) NEARBY SCHOOLS -------------

SCHOOLS_JSON=$(curl -s \
  "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${LAT},${LNG}&radius=${SCHOOL_RADIUS_M}&type=school&key=${API_KEY}")

school_status=$(echo "$SCHOOLS_JSON" | jq -r '.status')
if [ "$school_status" != "OK" ] && [ "$school_status" != "ZERO_RESULTS" ]; then
  echo "Warning: school search returned status=$school_status" >&2
fi

# ------------- 4) OUTPUT -------------

printf '========================================\n'
printf 'Location insights for:\n%s\n' "$FORMATTED_ADDRESS"
printf '========================================\n\n'

printf 'Getting around\n'

# Valeurs par défaut au cas où (évite les trucs vides ou non numériques)
walk_score=${walk_score:-0}
transit_score=${transit_score:-0}
bike_score=${bike_score:-0}
walk_text=${walk_text:-"Unknown"}
transit_text=${transit_text:-"Unknown"}
bike_text=${bike_text:-"Unknown"}

printf 'Walkability : %3d / 100  — %s\n' "$walk_score" "$walk_text"
printf 'Transit     : %3d / 100  — %s\n' "$transit_score" "$transit_text"
printf 'Bikeability : %3d / 100  — %s\n' "$bike_score" "$bike_text"
printf '\n'

echo "$SCHOOLS_JSON" \
  | jq -c '.results
           | map({name, rating, user_ratings_total, lat: .geometry.location.lat, lng: .geometry.location.lng})
           | sort_by(.rating // 0)
           | reverse
           | .[0:3][]' \
  | while read -r row; do
      name=$(echo "$row"   | jq -r '.name')
      rating=$(echo "$row" | jq -r '.rating // "N/A"')
      lat2=$(echo "$row"   | jq -r '.lat')
      lng2=$(echo "$row"   | jq -r '.lng')
      dist_km=$(haversine_km "$LAT" "$LNG" "$lat2" "$lng2")
      dist_mi=$(awk -v km="$dist_km" 'BEGIN{printf "%.1f", km * 0.621371}')
      printf "• %s — rating %s/5, distance: %s mi (%s km)\n" "$name" "$rating" "$dist_mi" "$dist_km"
    done

echo
