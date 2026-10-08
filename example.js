// Données d'exemple chargées à la création d'un foyer « avec exemple ».
window.BUDGET_EXAMPLE = {
 "version": 1,
 "annee": 2026,
 "personnes": [
  "Florian",
  "Partenaire"
 ],
 "repartition": "prorata",
 "livrets": [
  {
   "id": "l1",
   "nom": "Livret Impôts & maison",
   "solde": 900
  },
  {
   "id": "l2",
   "nom": "Livret Vacances",
   "solde": 1200
  },
  {
   "id": "l3",
   "nom": "Livret Fêtes & enfants",
   "solde": 300
  },
  {
   "id": "l4",
   "nom": "Livret Voitures",
   "solde": 400
  }
 ],
 "revenus": [
  {
   "id": "r1",
   "libelle": "Salaire net",
   "personne": "Florian",
   "type": "Salaire",
   "frequence": "Mensuel",
   "mois": 1,
   "montant": 3400
  },
  {
   "id": "r2",
   "libelle": "Salaire net",
   "personne": "Partenaire",
   "type": "Salaire",
   "frequence": "Mensuel",
   "mois": 1,
   "montant": 2300
  },
  {
   "id": "r3",
   "libelle": "Allocations familiales",
   "personne": "Commun",
   "type": "Aide",
   "frequence": "Mensuel",
   "mois": 1,
   "montant": 140
  },
  {
   "id": "r4",
   "libelle": "Prime annuelle",
   "personne": "Florian",
   "type": "Prime",
   "frequence": "Ponctuel",
   "mois": 12,
   "montant": 2500
  },
  {
   "id": "r5",
   "libelle": "Intéressement",
   "personne": "Partenaire",
   "type": "Prime",
   "frequence": "Ponctuel",
   "mois": 5,
   "montant": 1200
  },
  {
   "id": "r6",
   "libelle": "Remboursement mutuelle (lunettes)",
   "personne": "Commun",
   "type": "Remboursement",
   "frequence": "Ponctuel",
   "mois": 3,
   "montant": 180
  }
 ],
 "charges": [
  {
   "id": "c1",
   "libelle": "Prêt immobilier",
   "categorie": "Prêts",
   "compte": "Joint",
   "montant": 1150
  },
  {
   "id": "c2",
   "libelle": "Prêt voiture",
   "categorie": "Prêts",
   "compte": "Joint",
   "montant": 280
  },
  {
   "id": "c3",
   "libelle": "Assurance habitation",
   "categorie": "Assurances",
   "compte": "Joint",
   "montant": 38
  },
  {
   "id": "c4",
   "libelle": "Assurances autos",
   "categorie": "Assurances",
   "compte": "Joint",
   "montant": 95
  },
  {
   "id": "c5",
   "libelle": "Électricité & gaz",
   "categorie": "Énergie",
   "compte": "Joint",
   "montant": 160
  },
  {
   "id": "c6",
   "libelle": "Eau",
   "categorie": "Énergie",
   "compte": "Joint",
   "montant": 40
  },
  {
   "id": "c7",
   "libelle": "Box internet",
   "categorie": "Télécom",
   "compte": "Joint",
   "montant": 35
  },
  {
   "id": "c8",
   "libelle": "Forfaits mobiles",
   "categorie": "Télécom",
   "compte": "Joint",
   "montant": 30
  },
  {
   "id": "c9",
   "libelle": "Centre aéré & cantine",
   "categorie": "Enfants",
   "compte": "Joint",
   "montant": 180
  },
  {
   "id": "c10",
   "libelle": "Streaming (vidéo + musique)",
   "categorie": "Abonnements",
   "compte": "Joint",
   "montant": 28
  },
  {
   "id": "c11",
   "libelle": "Salle de sport",
   "categorie": "Abonnements",
   "compte": "Perso Florian",
   "montant": 35
  },
  {
   "id": "c12",
   "libelle": "Cours de yoga",
   "categorie": "Abonnements",
   "compte": "Perso Partenaire",
   "montant": 40
  }
 ],
 "provisions": [
  {
   "id": "p1",
   "libelle": "Taxe foncière",
   "livret": "l1",
   "montant": 1400,
   "mois": 10
  },
  {
   "id": "p2",
   "libelle": "Vacances d'hiver",
   "livret": "l2",
   "montant": 1500,
   "mois": 2
  },
  {
   "id": "p3",
   "libelle": "Vacances d'été",
   "livret": "l2",
   "montant": 3000,
   "mois": 7
  },
  {
   "id": "p4",
   "libelle": "Noël",
   "livret": "l3",
   "montant": 900,
   "mois": 12
  },
  {
   "id": "p5",
   "libelle": "Anniversaires enfants",
   "livret": "l3",
   "montant": 300,
   "mois": 4
  },
  {
   "id": "p6",
   "libelle": "Anniversaires famille & amis",
   "livret": "l3",
   "montant": 300,
   "mois": 9
  },
  {
   "id": "p7",
   "libelle": "Licences sport enfants",
   "livret": "l3",
   "montant": 450,
   "mois": 9
  },
  {
   "id": "p8",
   "libelle": "Rentrée scolaire",
   "livret": "l3",
   "montant": 250,
   "mois": 8
  },
  {
   "id": "p9",
   "libelle": "Révision voitures",
   "livret": "l4",
   "montant": 900,
   "mois": 3
  },
  {
   "id": "p10",
   "libelle": "Pneus & entretien",
   "livret": "l4",
   "montant": 450,
   "mois": 11
  },
  {
   "id": "p11",
   "libelle": "Petits travaux maison",
   "livret": "l1",
   "montant": 600,
   "mois": 5
  }
 ],
 "enveloppes": [
  {
   "id": "e1",
   "libelle": "Courses",
   "prevu": 800,
   "reel": {
    "1": 812,
    "2": 776,
    "3": 834,
    "4": 790,
    "5": 805,
    "6": 821,
    "7": 690,
    "8": 745
   }
  },
  {
   "id": "e2",
   "libelle": "Carburant",
   "prevu": 200,
   "reel": {
    "1": 185,
    "2": 210,
    "3": 196,
    "4": 205,
    "5": 188,
    "6": 214,
    "7": 260,
    "8": 240
   }
  },
  {
   "id": "e3",
   "libelle": "Loisirs & sorties",
   "prevu": 150,
   "reel": {
    "1": 120,
    "2": 175,
    "3": 140,
    "4": 160,
    "5": 210,
    "6": 130,
    "7": 95,
    "8": 110
   }
  },
  {
   "id": "e4",
   "libelle": "Vêtements",
   "prevu": 120,
   "reel": {
    "1": 60,
    "2": 90,
    "3": 180,
    "4": 140,
    "5": 75,
    "6": 110,
    "7": 40,
    "8": 220
   }
  },
  {
   "id": "e5",
   "libelle": "Santé (reste à charge)",
   "prevu": 50,
   "reel": {
    "1": 30,
    "2": 65,
    "3": 210,
    "4": 25,
    "5": 40,
    "6": 35,
    "7": 20,
    "8": 45
   }
  },
  {
   "id": "e6",
   "libelle": "Divers & imprévus",
   "prevu": 100,
   "reel": {
    "1": 80,
    "2": 120,
    "3": 95,
    "4": 60,
    "5": 140,
    "6": 75,
    "7": 130,
    "8": 90
   }
  }
 ]
};
