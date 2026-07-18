const standardPlotDefinitions = [
  {
    id: "average-current-density",
    name: "Priemerná prúdová hustota počas 8 h podľa dňa",
    basename: "average_current_density_by_day",
    plotType: "average-current-density",
    axisGroup: "average-current-density-by-day"
  },
  {
    id: "point-a",
    name: "Bod A — j pri 2,0 V",
    basename: "point_A",
    plotType: "point-a",
    axisGroup: "abc-current-density-by-day"
  },
  {
    id: "point-b",
    name: "Bod B — j pri 1,8 V ↑",
    basename: "point_B",
    plotType: "point-b",
    axisGroup: "abc-current-density-by-day"
  },
  {
    id: "point-c",
    name: "Bod C — j pri 1,8 V ↓",
    basename: "point_C",
    plotType: "point-c",
    axisGroup: "abc-current-density-by-day"
  },
  {
    id: "polarisation-curve",
    name: "Polarizačná krivka článku",
    basename: "polarisation_curve",
    plotType: "polarisation",
    axisGroup: "polarisation-curves"
  },
  {
    id: "stability-map",
    name: "Mapa mediánu výkonu a stability",
    basename: "stability_map",
    plotType: "stability-map",
    axisGroup: "stability-maps"
  }
];


function makeStandardPlots(
  idPrefix,
  folderPath,
) {
  return standardPlotDefinitions.map(
    plot => ({
      id: `${idPrefix}-${plot.id}`,
      name: plot.name,

      image:
        `${folderPath}/${plot.basename}.png`,

      interactive:
        `${folderPath}/${plot.basename}.json`,

      plotType: plot.plotType,
      axisGroup: plot.axisGroup,
      caption: ""
    })
  );
}


function makeCommercialPlots() {
  const folderPath =
    "images/5.8 porovnanie s komerčnou anódou";

  const standardPlots = makeStandardPlots(
    "5-8",
    folderPath,
  );

  return [
    standardPlots[0],
    standardPlots[1],
    standardPlots[2],
    standardPlots[3],
    standardPlots[4],

    {
      id: "5-8-polarisation-curve-corrected",
      name: "Polarizačná krivka článku – korekcia skratu",

      image:
        `${folderPath}/polarisation_curve-korigovaný.png`,

      interactive: null,

      plotType: "polarisation-corrected",
      axisGroup: "polarisation-curves",

      caption:
        "Polarizačná krivka po korekcii vplyvu skratu."
    },

    standardPlots[5]
  ];
}


window.THESIS_DATA = {
  siteTitle:
    "Doplňujúce grafy bakalárskej práce",

  siteSubtitle:
    "Interaktívny prehliadač grafov zoradených podľa kapitol práce",

  root: {
    id: "results",
    name: "Výsledky",
    files: [],

    children: [
      {
        id: "5-3",
        name: "5.3 Aktivácia AEM",
        children: [],

        files: makeStandardPlots(
          "5-3",
          "images/5.3 aktivácia AEM",
        )
      },


      {
        id: "5-4",
        name: "5.4 Leptanie membrány",
        files: [],

        children: [
          {
            id: "5-4-ni-450nm",
            name: "Ni 450 nm",
            children: [],

            files: makeStandardPlots(
              "5-4-ni-450nm",
              "images/5.4 leptanie membrány/ni 450nm",
            )
          },

          {
            id: "5-4-ni-fe-450nm",
            name: "Ni–Fe 450 nm",
            children: [],

            files: makeStandardPlots(
              "5-4-ni-fe-450nm",
              "images/5.4 leptanie membrány/ni-fe 450nm",
            )
          }
        ]
      },


      {
        id: "5-5",
        name:
          "5.5 Vplyv množstva naprášeného katalyzátora",
        children: [],

        files: makeStandardPlots(
          "5-5",
          "images/5.5 vplyv množstva naprášeného katalyzátora",
        )
      },


      {
        id: "5-6",
        name: "5.6 Vplyv prímesí v Ni",
        files: [],

        children: [
          {
            id: "5-6-ni-al",
            name: "Kodepozícia Ni–Al",
            children: [],

            files: makeStandardPlots(
              "5-6-ni-al",
              "images/5.6 vplyv prímesí v ni/kodepozícia ni-al",
            )
          },


          {
            id: "5-6-ni-fe",
            name: "Kodepozícia Ni–Fe",
            files: [],

            children: [
              {
                id: "5-6-ni-fe-leptana",
                name: "Ni–Fe leptaná",
                children: [],

                files: makeStandardPlots(
                  "5-6-ni-fe-leptana",
                  "images/5.6 vplyv prímesí v ni/kodepozícia ni-fe/ni-fe leptaná",
                )
              },

              {
                id: "5-6-ni-fe-neleptana",
                name: "Ni–Fe neleptaná",
                children: [],

                files: makeStandardPlots(
                  "5-6-ni-fe-neleptana",
                  "images/5.6 vplyv prímesí v ni/kodepozícia ni-fe/ni-fe neleptaná",
                )
              },

              {
                id: "5-6-ni-feox",
                name: "Ni–FeOx",
                children: [],

                files: makeStandardPlots(
                  "5-6-ni-feox",
                  "images/5.6 vplyv prímesí v ni/kodepozícia ni-fe/ni-feox",
                )
              }
            ]
          }
        ]
      },


      {
        id: "5-7",
        name:
          "5.7 Vplyv tlaku a pracovného plynu",
        files: [],

        children: [
          {
            id: "5-7-pracovny-plyn",
            name: "Vplyv pracovného plynu",
            children: [],

            files: makeStandardPlots(
              "5-7-pracovny-plyn",
              "images/5.7 vplyv tlaku a pracovného plynu/vplyv pracovného plynu",
            )
          },

          {
            id: "5-7-tlak",
            name: "Vplyv tlaku",
            children: [],

            files: makeStandardPlots(
              "5-7-tlak",
              "images/5.7 vplyv tlaku a pracovného plynu/vplyv tlaku",
            )
          }
        ]
      },


      {
        id: "5-8",
        name:
          "5.8 Porovnanie s komerčnou anódou",
        children: [],
        files: makeCommercialPlots()
      }
    ]
  }
};
