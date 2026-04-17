import {
    Flame,
    Activity,
    Building2,
    Droplets,
    HeartPulse,
    Biohazard,
    Car,
    AlertTriangle,
} from "lucide-react";

export const DisasterIcon = {
    Fire: Flame,
    Earthquake: Activity,
    "Building Collapse": Building2,
    Flood: Droplets,
    "Medical Emergency": HeartPulse,
    "Biohazard/Chemical Spill": Biohazard,
    "Traffic Accident": Car,
    Other: AlertTriangle,
};

export const getDisasterColor = (type: string) => {
    switch (type) {
        case "Fire":
            return "text-red-500";
        case "Flood":
            return "text-blue-500";
        case "Medical Emergency":
            return "text-pink-500";
        default:
            return "text-yellow-500";
    }
};