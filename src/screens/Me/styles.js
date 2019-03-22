import { Platform } from 'react-native';
import styled from 'styled-components/native';
import { spacing, fontSizes, fontTrackings, baseColors } from 'utils/variables';
import { BaseText } from 'components/Typography';

export const CardContainer = styled.View` 
  align-items: center;
  background-color: ${baseColors.whiteSmoke};
  padding: 16px;
  border-bottom-width: 1;
  border-bottom-color: ${baseColors.mediumLightGray};
`;

export const Card = styled.View`
`;

export const CardBoard = styled.View`
  align-items: center;
  background-color: ${baseColors.white};
  border-radius: 6;
  height: ${({ height }) => height}px;
  padding: 15px 0 10px;
`;

export const PersonaLabel = styled.View`
  align-items: center;
  flex-direction: row;
  justify-content: center;
  margin: 3px 0 18px;
  width: 100%;
`;

export const CurrentPersona = styled(BaseText)`
  color: ${baseColors.slateBlack};
  font-size: 16px;
  font-weight: bold;
`;

export const PersonaSquare = styled.View`
  border: solid 1px ${baseColors.burningFire};
  border-radius: 2px;
  padding: 0 2px;
  margin: 2px 6px 0;
`;

export const PersonaTrademark = styled(BaseText)`
  color: ${baseColors.burningFire};
  font-size: 10px;
`;

export const NewSession = styled.View`
`;
