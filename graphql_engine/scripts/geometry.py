"""
Parse a dump from MINT tables region and region_geometry and generates files per regions
"""
import os
import argparse
from typing import List, Dict
import time
import sqlglot
import sqlglot.expressions as exp

def dir_path(string):
    if os.path.isdir(string):
        return string
    else:
        raise NotADirectoryError(string)

def read_geometry_file(file: argparse.FileType) -> Dict[str, List[str]]:
    """Reads a geometry file and returns a dictionary of region names to geometry

    Args:
        file (argparse.FileType): The file to read

    Returns:
        Dict[str, List[str]]: A dictionary of region names to geometry
    """
    geometry = {}
    for line in file:
        try:
            line_parsed = sqlglot.parse_one(line)
        except:
            print("Failed to parse line: " + line)
            exit(1)
        if line_parsed and line_parsed.find(exp.Insert):
            for values in line_parsed.find_all(exp.Values):
                region_name=str(values.expressions[0].expressions[1]).replace("'", "")
                if region_name in geometry and geometry[region_name] != line:
                    geometry[region_name].append(line)
                elif region_name in geometry and geometry[region_name] == line:
                    print("Duplicate entry for region: " + region_name)
                else:
                    geometry[region_name]=[line]
    return geometry

def write_file(regions: Dict[str, List[str]], destination: str, file_prefix: str):
    timestamp = str(time.time_ns())
    for region in regions:
        print(f"Writing file for region: {len(regions[region])} {region}")
        with open(os.path.join(destination, timestamp + "_" + region + "_" + file_prefix + ".sql"), "w") as file:
            file.writelines(regions[region])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--region', type=argparse.FileType('r'))
    parser.add_argument('--geometry', type=argparse.FileType('r'))
    parser.add_argument('destination', type=dir_path)
    args = parser.parse_args()

    region_file = args.region
    region_geometry_file = args.geometry
    destination_dir = args.destination
    parent_regions = {}
    regions = {}
    region_geometry = read_geometry_file(region_geometry_file)
    for line in region_file:
        line_parsed = sqlglot.parse_one(line)
        if line_parsed and line_parsed.find(exp.Insert):
            for values in line_parsed.find_all(exp.Values):
                region_name=str(values.expressions[0].expressions[0]).replace("'", "")
                parent_name=str(values.expressions[0].expressions[2]).replace("'", "")
                if not parent_name or parent_name == "NULL":
                    parent_name = region_name
                elif not parent_name and not region_name:
                    exit(1)
                # Group Data SQL statements by parent region 
                if parent_name in regions:
                    regions[parent_name].append(line)
                else:
                    regions[parent_name] = [line]
                # Group Geometry SQL statements by parent region 
                if region_name in region_geometry:
                    region_geometry_item = region_geometry[region_name]
                    if isinstance(region_geometry_item, list):
                        if parent_name in parent_regions:
                            parent_regions[parent_name].extend(region_geometry_item)
                        else:
                            parent_regions[parent_name] = region_geometry_item
                    else:
                        parent_regions[parent_name] = [region_geometry_item]
                else:
                    print("No geometry for region: " + region_name)
    write_file(regions, destination_dir, "data")
    write_file(parent_regions, destination_dir, "geometry")


if __name__ == "__main__":
    main()