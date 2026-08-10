export class LocationGeocodeError extends Error {}
export class LocationGeocodeCanceledError extends Error {}

export function createLocationGeocoder(fetchImpl = fetch) {
  let generation = 0;
  let inFlight = null;

  return {
    resolve(rawQuery) {
      const query = rawQuery.trim();
      if (!query) return Promise.resolve(null);
      if (inFlight?.query === query) return inFlight.promise;

      const requestGeneration = ++generation;
      const promise = (async () => {
        const response = await fetchImpl(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
        if (requestGeneration !== generation) throw new LocationGeocodeCanceledError('Location lookup was canceled');
        if (!response.ok) throw new LocationGeocodeError('Geocoding request failed');
        const result = (await response.json()).results?.[0];
        if (!result || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
          throw new LocationGeocodeError('Location not found');
        }
        if (requestGeneration !== generation) throw new LocationGeocodeCanceledError('Location lookup was canceled');
        return {
          query,
          latitude: result.latitude,
          longitude: result.longitude,
          label: [result.name, result.admin1, result.country].filter(Boolean).join(', '),
        };
      })().catch(error => {
        if (requestGeneration !== generation) throw new LocationGeocodeCanceledError('Location lookup was canceled', { cause: error });
        if (error instanceof LocationGeocodeCanceledError) throw error;
        if (error instanceof LocationGeocodeError) throw error;
        throw new LocationGeocodeError('Geocoding request failed', { cause: error });
      }).finally(() => {
        if (inFlight?.promise === promise) inFlight = null;
      });

      inFlight = { query, promise };
      return promise;
    },
    cancel() {
      generation += 1;
      inFlight = null;
    },
  };
}

export async function persistProfileWithResolvedLocation(profile, rawQuery, geocoder, persist, options = {}) {
  const query = rawQuery.trim();
  if (!query || options.demoMode) {
    await persist(profile);
    return { profile, resolved: null, locationWarning: false };
  }

  let resolved = options.resolvedLocation?.query === query
    ? options.resolvedLocation
    : null;
  if (!resolved) {
    try {
      resolved = await geocoder.resolve(query);
    } catch (error) {
      if (error instanceof LocationGeocodeCanceledError) throw error;
      const profileToSave = options.profileOnLocationFailure || profile;
      await persist(profileToSave);
      return { profile: profileToSave, resolved: null, locationWarning: true };
    }
  }
  if (resolved.query !== query) throw new LocationGeocodeCanceledError('Location changed while saving');
  const profileToSave = { ...profile, latitude: resolved.latitude, longitude: resolved.longitude };
  await persist(profileToSave);
  return { profile: profileToSave, resolved, locationWarning: false };
}
