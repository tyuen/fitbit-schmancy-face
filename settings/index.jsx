registerSettingsPage(props => {
  let W = props.settingsStorage.getItem("screenWidth");
  let H = props.settingsStorage.getItem("screenHeight");

  return (
    <Page>
      <ImagePicker
        settingsKey="bkgd"
        label="Choose Background Image"
        description={props.settings.bkgd ? "The image transfer may take up to 30 seconds." : null}
        imageWidth={W}
        imageHeight={H}
      />
      {props.settings.bkgd ? <Button label="Clear Background Image" onClick={()=>{props.settingsStorage.setItem("bkgd","")}} /> : null}

      <Section title="Transparency">
        <Slider label="Stats" settingsKey="showStats" min="0" max="100" />
        <Slider label="Markers" settingsKey="showMarker" min="0" max="100" />
        <Slider label="Date/Battery" settingsKey="showCorner" min="0" max="100" />
      </Section>
    </Page>
  ); 
});
