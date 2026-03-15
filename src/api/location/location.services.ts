import { InternalServerError, NotFoundError } from "elysia";
import { locationRepo } from "../../repo/location.repo";
import { getCountryFromCoordinates } from "../../utils/location";

export const locationService = {
  createLocation: async (
    userId: string,
    latitude: string,
    longitude: string,
  ) => {
    const parsedLat = parseFloat(latitude);
    const parsedLng = parseFloat(longitude);

    const isValidCoords = !isNaN(parsedLat) && !isNaN(parsedLng);
    const country = isValidCoords
      ? getCountryFromCoordinates(parsedLat, parsedLng)
      : null;

    const finalLat = country?.abrv ? latitude : "9.044679";
    const finalLng = country?.abrv ? longitude : "7.51913154046585";
    const finalCountry = country?.abrv ?? "NG";

    let location;

    try {
      location = await locationRepo.createLocation(
        userId,
        finalLat,
        finalLng,
        finalCountry,
      );
    } catch (error) {
      throw new InternalServerError("Failed to create user location.");
    }

    if (!location) {
      throw new InternalServerError("Location could not be created.");
    }

    return location;
  },

  updateLocation: async (
    userId: string,
    latitude: string,
    longitude: string,
    countryAbbreviation?: string,
  ) => {
    let location;

    try {
      location = await locationRepo.updateLocation(
        userId,
        latitude,
        longitude,
        countryAbbreviation,
      );
    } catch (error) {
      throw new InternalServerError(
        "An error occurred while updating the location.",
      );
    }

    if (!location) {
      throw new NotFoundError(
        "Location record not found for the specified user.",
      );
    }

    return location;
  },
};
