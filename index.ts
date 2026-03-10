import { scrape_all_sea } from "./wikidata_scraper";
import { writeFileSync } from "fs";

const people = await scrape_all_sea()
writeFileSync("out/people.full.json", JSON.stringify(people, null, 2));