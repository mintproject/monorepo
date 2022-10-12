"""
Parse MINT Table region_geometry per region and write to file
"""

import argparse
from typing import List, dict

import sqlglot
import sqlglot.expressions as exp

def read_geometry_file(file: argparse.FileType) -> dict[str, List[str]]:
    """Reads a geometry file and returns a dictionary of region names to geometry

    Args:
        file (argparse.FileType): The file to read

    Returns:
        dict[str, List[str]]: A dictionary of region names to geometry
    """
    geometry = {}
    for line in file:
        for values in sqlglot.parse_one(line).find_all(exp.Values):
            value=values.expressions[0].expressions[1]
            if value in geometry and geometry[value] != line:
                geometry[value].append(line)
            elif value in geometry and geometry[value] == line:
                print("Duplicate entry for region: " + value)
            else:
                geometry[value]=[line]
    return geometry

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('region_file', type=argparse.FileType('r'))
    parser.add_argument('region_geometry_file', type=argparse.FileType('r'))
    parser.add_argument('outfile', type=argparse.FileType('w'))
    args = parser.parse_args()

    region_geometry = read_geometry_file(args.region_geometry_file)
    for line in args.region_file:
        for values in sqlglot.parse_one(line).find_all(exp.Values):
            value=values.expressions[0].expressions[0]
            if value in region_geometry:
                if isinstance(region_geometry[value], list):
                    for entry in region_geometry[value]:
                        args.outfile.write(entry)
                else:
                    args.outfile.write(region_geometry[value])
            else:
                print("No geometry for region: " + value)

            


if __name__ == "__main__":
    main()