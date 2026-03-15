declare module "coordinate_to_country" {
  export default function coordinateToCountry(
    lat: number,
    lon: number,
    iso2?: boolean,
  ): string[];
}
