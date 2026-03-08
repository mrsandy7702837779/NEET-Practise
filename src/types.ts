import { Type } from "@google/genai";

export interface Question {
  id: string;
  subject: 'Physics' | 'Chemistry' | 'Biology';
  section?: string;
  chapter?: string;
  question: string;
  options: string[];
  correctAnswer: number; // 0-3
  explanation: string;
  explanationDiagramSvg?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  type: 'Conceptual' | 'Numerical' | 'Assertion-Reason';
}

export const PHYSICS_CHAPTERS = [
  "Modern Physics",
  "Semiconductor Electronics",
  "Current Electricity",
  "Units, Dimensions & Error Analysis",
  "Electrostatics (Basic Part Only)"
];

export const PHYSICS_TOPICS: Record<string, string[]> = {
  "Modern Physics": [
    "Photoelectric Effect",
    "Einstein’s Photoelectric Equation",
    "Bohr Model of Hydrogen Atom",
    "Energy Levels & Hydrogen Spectrum",
    "Half-life and Mean life",
    "Nuclear Fission & Fusion",
    "Binding Energy and Mass Defect"
  ],
  "Semiconductor Electronics": [
    "Conductors, Insulators, Semiconductors",
    "Intrinsic and Extrinsic Semiconductors",
    "P-type and N-type Semiconductors",
    "PN Junction Diode",
    "Forward Bias & Reverse Bias",
    "Zener Diode and Voltage Regulation",
    "Rectifiers (Half-wave & Full-wave basic idea)",
    "Logic Gates (AND, OR, NOT, NAND, NOR)"
  ],
  "Current Electricity": [
    "Electric Current and Drift Velocity",
    "Ohm’s Law",
    "Resistance and Resistivity",
    "Temperature Dependence of Resistance",
    "Series and Parallel Combination of Resistors",
    "Kirchhoff’s Laws",
    "Wheatstone Bridge",
    "Meter Bridge",
    "Electric Power and Electrical Energy"
  ],
  "Units, Dimensions & Error Analysis": [
    "SI Units and Fundamental Units",
    "Dimensional Formula of Physical Quantities",
    "Principle of Homogeneity",
    "Dimensional Analysis",
    "Significant Figures",
    "Absolute Error, Relative Error, Percentage Error",
    "Error Propagation"
  ],
  "Electrostatics (Basic Part Only)": [
    "Coulomb’s Law",
    "Electric Field",
    "Electric Field Lines",
    "Electric Potential",
    "Potential Difference",
    "Relation between Electric Field & Potential",
    "Capacitors and Capacitance",
    "Parallel Plate Capacitor",
    "Energy Stored in Capacitor"
  ]
};

export const CHEMISTRY_SECTIONS = [
  "Physical Chemistry",
  "Organic Chemistry",
  "Inorganic Chemistry"
];

export const BIOLOGY_SECTIONS = [
  "Botany",
  "Zoology"
];
