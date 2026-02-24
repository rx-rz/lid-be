import { locationRepo } from "../../repo/location.repo";
import { getCountryFromCoordinates } from "../../utils/location";

export const locationService = {
  createLocation: async (
    userId: string,
    latitude: string,
    longitude: string,
  ) => {
    const country = await getCountryFromCoordinates(
      parseFloat(latitude),
      parseFloat(longitude),
    );

    if (country?.abrv) {
      return await locationRepo.createLocation(
        userId,
        latitude,
        longitude,
        country.abrv,
      );
    }

    return await locationRepo.createLocation(
      userId,
      "9.044679",
      "7.51913154046585",
      "NG",
    );
  },

  updateLocation: async (
    userId: string,
    latitude: string,
    longitude: string,
    countryAbbreviation?: string,
  ) => {
    return await locationRepo.updateLocation(
      userId,
      latitude,
      longitude,
      countryAbbreviation,
    );
  },
};
